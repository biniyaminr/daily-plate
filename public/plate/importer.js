// Safe backup import: validate on the server, preview what would change,
// then either add missing records (default) or, only when explicitly
// confirmed, replace the account's records.
(() => {
  const KINDS = ['fitness', 'nutrition'];
  const MAX_BYTES = 5_000_000;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const keys = (o) => Object.keys(o || {});
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  function dateRange(dates) {
    const sorted = [...dates].sort();
    return sorted.length ? (sorted[0] === sorted.at(-1) ? sorted[0] : `${sorted[0]} to ${sorted.at(-1)}`) : null;
  }

  const LABELS = { weight: 'starting weight', height: 'height', start: 'program start date', walk: 'walking target', note: 'note', sleep: 'sleep', recovery: 'recovery day', goals: 'daily targets', name: 'name', goal: 'goal', sex: 'sex', age: 'age', activity: 'activity level', fasting: 'fasting days' };
  const show = (v) => (v === null || v === undefined ? 'empty' : typeof v === 'object' ? JSON.stringify(v) : String(v));

  /** Values present in both copies that differ, described for people. Pure. */
  function differences(kind, current, incoming, limit = 6) {
    const found = [];
    const add = (label, a, b) => { if (found.length < limit) found.push({ label, account: show(a), backup: show(b) }); };
    if (!current || !incoming) return found;
    if (kind === 'fitness') {
      for (const k of keys(incoming.profile)) {
        if (current.profile && k in current.profile && current.profile[k] !== incoming.profile[k]) add(LABELS[k] || k, current.profile[k], incoming.profile[k]);
      }
      for (const d of keys(incoming.weights)) {
        if (d in (current.weights || {}) && current.weights[d] !== incoming.weights[d]) add(`weigh-in ${d}`, current.weights[d], incoming.weights[d]);
      }
      for (const d of keys(incoming.logs)) {
        const a = current.logs?.[d], b = incoming.logs[d];
        if (!a) continue;
        for (const k of ['walk', 'sleep', 'recovery', 'note']) if (k in a && k in b && a[k] !== b[k]) add(`${LABELS[k]} on ${d}`, a[k], b[k]);
        for (const s of keys(b.sets)) if (a.sets?.[s] && JSON.stringify(a.sets[s]) !== JSON.stringify(b.sets[s])) add(`workout set ${s} on ${d}`, a.sets[s], b.sets[s]);
      }
    } else {
      if (current.goals && JSON.stringify(current.goals) !== JSON.stringify(incoming.goals)) add(LABELS.goals, current.goals.join(' / '), incoming.goals.join(' / '));
      for (const d of keys(incoming.days)) {
        for (const row of incoming.days[d]) {
          const existing = current.days?.[d]?.find((r) => r.id === row.id);
          if (existing && JSON.stringify(existing) !== JSON.stringify(row)) add(`${row.food[0]} on ${d}`, `${existing.grams} g`, `${row.grams} g`);
        }
      }
    }
    return found;
  }

  /** Counts what a backup holds and what a non-destructive import would add. Pure. */
  function summarize(kind, current, incoming) {
    const merged = PlateMerge(kind, current, incoming);
    if (kind === 'fitness') {
      const weights = keys(incoming.weights), days = keys(incoming.logs);
      return {
        kind,
        merged: merged.value,
        conflicts: merged.conflicts,
        weighIns: weights.length,
        newWeighIns: weights.filter((d) => !(d in (current?.weights || {}))).length,
        days: days.length,
        newDays: days.filter((d) => !(d in (current?.logs || {}))).length,
        range: dateRange([...weights, ...days]),
        changes: JSON.stringify(merged.value) !== JSON.stringify(current),
      };
    }
    const dates = keys(incoming.days);
    let rows = 0, newRows = 0;
    for (const d of dates) {
      const existing = new Set((current?.days?.[d] || []).map((r) => r.id));
      for (const row of incoming.days[d]) {
        rows++;
        if (!existing.has(row.id)) newRows++;
      }
    }
    return {
      kind,
      merged: merged.value,
      conflicts: merged.conflicts,
      days: dates.filter((d) => incoming.days[d].length).length,
      rows,
      newRows,
      range: dateRange(dates.filter((d) => incoming.days[d].length)),
      changes: JSON.stringify(merged.value) !== JSON.stringify(current),
    };
  }

  function describe(s) {
    if (s.kind === 'fitness') {
      return `<b>Workouts &amp; progress</b>: ${plural(s.weighIns, 'weigh-in')} and ${plural(s.days, 'logged day')}${s.range ? ` (${esc(s.range)})` : ''}. New to your account: ${plural(s.newWeighIns, 'weigh-in')}, ${plural(s.newDays, 'day')}.`;
    }
    return `<b>Food log</b>: ${plural(s.rows, 'food entry', 'food entries')} on ${plural(s.days, 'day')}${s.range ? ` (${esc(s.range)})` : ''}. New to your account: ${plural(s.newRows, 'food entry', 'food entries')}.`;
  }

  async function readBackup(file) {
    if (!file) return { errors: ['No file selected.'] };
    if (file.size > MAX_BYTES) return { errors: ['This file is larger than 5 MB, so it is not a backup from this app.'] };
    const text = await file.text();
    let backup;
    try { backup = JSON.parse(text); } catch { return { errors: ['This file is not valid JSON.'] }; }

    let response;
    try {
      response = await fetch('/api/progress/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return { errors: ['Could not reach your account to check the file. Try again when online.'] };
    }
    if (response.status === 401) return { errors: ['Your session has ended. Sign in again, then import.'] };
    if (!response.ok) return { errors: ['The file could not be checked right now. Try again.'] };
    const result = await response.json();
    if (!result.valid) {
      const errors = [...result.errors];
      for (const kind of KINDS) {
        for (const e of result.kinds?.[kind]?.errors || []) errors.push(`${kind}: ${e}`);
      }
      return { errors: errors.length ? errors : ['This backup did not pass validation.'] };
    }
    return { backup, kinds: KINDS.filter((k) => result.kinds[k]?.present) };
  }

  function dialog() {
    let el = document.getElementById('importDialog');
    if (!el) {
      el = document.createElement('dialog');
      el.id = 'importDialog';
      el.className = 'importdialog';
      el.setAttribute('aria-labelledby', 'importTitle');
      document.body.append(el);
    }
    return el;
  }

  function showErrors(el, name, errors) {
    el.innerHTML = `<h2 id="importTitle">Can’t import ${esc(name)}</h2><p>Nothing was changed.</p><ul class="importerrors">${errors.slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}</ul><div class="importbuttons"><button type="button" class="primary" data-close>Close</button></div>`;
    el.querySelector('[data-close]').onclick = () => el.close();
  }

  function showPreview(el, file, backup, kinds) {
    const summaries = kinds.map((k) => summarize(k, PlateCloud.current(k), backup[k]));
    const conflicts = summaries.reduce((n, s) => n + s.conflicts, 0);
    const diffs = kinds.flatMap((k) => differences(k, PlateCloud.current(k), backup[k])).slice(0, 6);
    const anyChange = summaries.some((s) => s.changes);
    const exported = typeof backup.exportedAt === 'string' ? ` · exported ${esc(backup.exportedAt.slice(0, 10))}` : '';

    el.innerHTML = `<form method="dialog" class="importform">
      <h2 id="importTitle">Import a backup</h2>
      <p class="small">${esc(file.name)}${exported} · checked and valid</p>
      <ul class="importsummary">${summaries.map((s) => `<li>${describe(s)}</li>`).join('')}</ul>
      ${conflicts ? `<div class="callout"><p>${plural(conflicts, 'value')} in the backup differ from your account. With “Add missing records” your account’s value stays:</p><ul class="importdiffs">${diffs.map((d) => `<li>${esc(d.label)}: account <b>${esc(d.account)}</b>, backup <b>${esc(d.backup)}</b></li>`).join('')}${conflicts > diffs.length ? `<li>…and ${conflicts - diffs.length} more</li>` : ''}</ul><p>You can change any of these afterwards, or choose Replace below.</p></div>` : ''}
      <fieldset><legend>How to import</legend>
        <label class="check"><input type="radio" name="mode" value="merge" checked> <span><b>Add missing records</b> (recommended). Nothing in your account is removed or changed${conflicts ? '; where values differ, your account’s value is kept' : ''}.</span></label>
        <label class="check"><input type="radio" name="mode" value="replace"> <span><b>Replace my account records</b> with this backup. A copy of your current records downloads first.</span></label>
        <label class="replaceconfirm" hidden>Type REPLACE to confirm<input name="confirm" autocomplete="off" spellcheck="false"></label>
      </fieldset>
      <p class="importresult" role="status" aria-live="polite"></p>
      <div class="importbuttons"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary">Import</button></div>
    </form>`;

    const form = el.querySelector('form');
    const status = el.querySelector('.importresult');
    const confirmBox = el.querySelector('.replaceconfirm');
    form.onchange = () => { confirmBox.hidden = form.mode.value !== 'replace'; };
    el.querySelector('[data-close]').onclick = () => el.close();

    form.onsubmit = async (event) => {
      event.preventDefault();
      const mode = form.mode.value;
      if (!PlateCloud.canImport()) {
        status.textContent = 'Saving is paused (offline, signed out or a sync conflict). Resolve that first.';
        return;
      }
      if (mode === 'replace' && form.confirm.value.trim() !== 'REPLACE') {
        status.textContent = 'Type REPLACE to confirm replacing your records.';
        form.confirm.focus();
        return;
      }
      if (mode === 'merge' && !anyChange) {
        status.textContent = 'Everything in this backup is already in your account. Nothing to import.';
        return;
      }

      const values = {};
      for (const s of summaries) {
        if (mode === 'replace') values[s.kind] = backup[s.kind];
        else if (s.changes) values[s.kind] = s.merged;
      }
      if (mode === 'replace') PlateCloud.downloadBackup('before-replace');

      form.querySelectorAll('button, input').forEach((b) => { b.disabled = true; });
      status.textContent = 'Importing…';
      const result = await PlateCloud.applyImport(values);
      if (!result.ok) {
        status.textContent = `Not fully imported: ${result.message} Your backup file is unchanged; you can try again.`;
        form.querySelectorAll('button, input').forEach((b) => { b.disabled = false; });
        return;
      }
      const added = summaries.map((s) => (s.kind === 'fitness'
        ? `${plural(s.newWeighIns, 'weigh-in')} and ${plural(s.newDays, 'logged day')}`
        : plural(s.newRows, 'food entry', 'food entries')));
      el.innerHTML = `<h2 id="importTitle">Import complete</h2><p>${mode === 'replace'
        ? `Replaced your ${summaries.map((s) => (s.kind === 'fitness' ? 'workouts &amp; progress' : 'food log')).join(' and ')} with the backup. Your previous records were downloaded first.`
        : `Added ${added.join(', ')} to your account.${conflicts ? ` ${plural(conflicts, 'differing value')} kept your account’s version.` : ''}`}</p><p class="small">Saved to your account. It will appear on your other devices too.</p><div class="importbuttons"><button type="button" class="primary" data-done>Done</button></div>`;
      el.querySelector('[data-done]').onclick = () => PlateCloud.reload();
    };
  }

  async function open(file) {
    const el = dialog();
    el.innerHTML = '<p role="status">Checking the backup…</p>';
    if (!el.open) el.showModal();
    const { backup, kinds, errors } = await readBackup(file);
    if (errors) return showErrors(el, file?.name || 'file', errors);
    showPreview(el, file, backup, kinds);
  }

  function pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => open(input.files[0]);
    input.click();
  }

  globalThis.PlateImport = { summarize, differences, open, pick };
})();
