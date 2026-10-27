// Photo food log: shrink the photo in the browser, ask the server to estimate
// the foods, let the person correct the estimate, then add it to the log.
// The photo is not stored.
(() => {
  const $ = (id) => document.getElementById(id);
  const box = $('snapResult');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MAX_SIDE = 1280;
  let photo = null, items = [];

  async function shrink(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  function goal() {
    try { return JSON.parse(PlateStorage.getItem('benjiFitness.v1'))?.profile?.goal; } catch { return undefined; }
  }

  function showPhoto() {
    box.innerHTML = `<img class="snapphoto" src="${photo}" alt="Your meal photo">
      <label class="label" for="snapNote">Anything the photo doesn’t show? <span class="snapopt">optional</span></label>
      <textarea id="snapNote" maxlength="300" rows="2" placeholder="e.g. I ate half the injera, cooked with niter kibbeh"></textarea>
      <div class="snapbuttons"><button type="button" class="primary" id="snapGo">Analyse my meal</button><button type="button" class="textbtn" id="snapReset">Cancel</button></div>
      <p class="snapprivacy">The photo is sent to Claude (Anthropic’s AI) for analysis. Enjera doesn’t keep it.</p>`;
    $('snapGo').onclick = analyse;
    $('snapReset').onclick = reset;
  }

  function reset() { photo = null; items = []; box.innerHTML = ''; }

  function fail(message) {
    box.querySelector('.snapstatus')?.remove();
    box.insertAdjacentHTML('beforeend', `<p class="snaperror" role="alert">${esc(message)}</p>`);
    const go = $('snapGo');
    if (go) { go.disabled = false; go.textContent = 'Try again'; }
  }

  async function analyse() {
    const go = $('snapGo');
    go.disabled = true;
    go.textContent = 'Analysing…';
    box.querySelector('.snaperror')?.remove();
    box.insertAdjacentHTML('beforeend', '<p class="snapstatus" role="status">Looking at your plate. This takes about 10–30 seconds.</p>');
    let response, body;
    try {
      response = await fetch('/api/food/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo, note: $('snapNote').value.trim() || undefined, goal: goal() }),
        signal: AbortSignal.timeout(120000),
      });
      body = await response.json();
    } catch {
      return fail('Couldn’t reach the analyser. Check your connection and try again.');
    }
    if (!response.ok) return fail(body?.error || 'The photo couldn’t be analysed. Try again.');
    const a = body.analysis;
    if (!a.is_food) return fail(a.meal_summary ? `No food found: ${a.meal_summary}` : 'No food was found in this photo. Try a closer photo of the plate.');
    items = a.items.map((item) => ({ ...item, include: true }));
    showResult(a);
  }

  const per = (item, i) => [item.kcal_per_100g, item.protein_per_100g, item.carbs_per_100g, item.fat_per_100g][i] * item.grams / 100;

  function totals() {
    return items.filter((x) => x.include).reduce((t, item) => t.map((v, i) => v + per(item, i)), [0, 0, 0, 0]);
  }

  function showResult(a) {
    box.innerHTML = `<img class="snapphoto small" src="${photo}" alt="Your meal photo">
      <p class="snapsummary">${esc(a.meal_summary)}</p>
      <div class="snapitems">${items.map((item, i) => `<div class="snapitem">
        <label class="snapcheck"><input type="checkbox" data-include="${i}" checked aria-label="Include ${esc(item.name)}"></label>
        <div class="snapname"><b>${esc(item.name)}</b>${item.local_name ? ` <span lang="am">${esc(item.local_name)}</span>` : ''}
          <small>${esc(item.portion_note)} · <span class="conf ${item.confidence}">${item.confidence} confidence</span></small></div>
        <label class="snapgrams"><input type="number" min="1" max="5000" step="1" value="${item.grams}" data-grams="${i}" aria-label="${esc(item.name)} grams"> g</label>
        <span class="snapkcal" data-kcal="${i}">${Math.round(per(item, 0))} kcal</span>
      </div>`).join('')}</div>
      <div class="snaptotal" id="snapTotal"></div>
      ${a.tips.length ? `<ul class="snaptips">${a.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <p class="snapprivacy">These are estimates. Adjust the grams if you know better. You can edit entries in your log later.</p>
      <label class="label" for="snapMeal">Add to meal</label>
      <select id="snapMeal">${['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((m) => `<option ${m === $('meal').value ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <div class="snapbuttons"><button type="button" class="primary" id="snapAdd">Add to my food log</button><button type="button" class="textbtn" id="snapReset">Discard</button></div>`;
    updateTotal();
    box.oninput = box.onchange = (e) => {
      const g = e.target.dataset.grams, inc = e.target.dataset.include;
      if (g !== undefined) {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v >= 1 && v <= 5000) items[g].grams = v;
        box.querySelector(`[data-kcal="${g}"]`).textContent = `${Math.round(per(items[g], 0))} kcal`;
      }
      if (inc !== undefined) items[inc].include = e.target.checked;
      updateTotal();
    };
    $('snapAdd').onclick = add;
    $('snapReset').onclick = reset;
  }

  function updateTotal() {
    const t = totals(), n = items.filter((x) => x.include).length;
    $('snapTotal').innerHTML = `<b>${Math.round(t[0]).toLocaleString()} kcal</b> · protein ${Math.round(t[1])} g · carbs ${Math.round(t[2])} g · fat ${Math.round(t[3])} g`;
    $('snapAdd').disabled = !n;
    $('snapAdd').textContent = n ? `Add ${n} item${n === 1 ? '' : 's'} to my food log` : 'Choose at least one item';
  }

  function add() {
    const meal = $('snapMeal').value;
    const rows = items.filter((x) => x.include).map((x) => ({
      food: [x.name, x.kcal_per_100g, x.protein_per_100g, x.carbs_per_100g, x.fat_per_100g],
      grams: Math.round(x.grams),
      meal,
    }));
    PlateLog.add(rows, `Added ${rows.length} item${rows.length === 1 ? '' : 's'} from your photo to ${meal.toLowerCase()}`);
    reset();
  }

  async function pick(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    box.innerHTML = '<p class="snapstatus" role="status">Preparing photo…</p>';
    try {
      photo = await shrink(file);
    } catch {
      box.innerHTML = '<p class="snaperror" role="alert">This photo couldn’t be opened. Try a JPEG or PNG.</p>';
      return;
    }
    showPhoto();
  }

  $('snapCamera').onchange = (e) => pick(e.target);
  $('snapGallery').onchange = (e) => pick(e.target);
})();
