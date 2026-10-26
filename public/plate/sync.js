// Private cloud saving for Benji's Daily Plate.
//
// The page is only served to a signed-in user (see lib/shell.ts), who is named
// in <meta name="plate-user">. Records load from /api/progress; edits are kept
// in a per-account localStorage cache until the server confirms them, and
// every save is a compare-and-swap on the record revision so an old tab cannot
// silently overwrite newer data.
(() => {
  const scripts = document.currentScript.dataset.scripts.split(',');
  const KEYS = { 'benjiFitness.v1': 'fitness', 'dailyPlate.v1': 'nutrition' };
  const KINDS = ['fitness', 'nutrition'];
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  const user = meta('plate-user');
  const email = meta('plate-email');
  const cacheKey = `dailyPlate.cloud.${user}.cache`;
  const here = location.pathname + location.search;

  let records = {}, pending = {};
  let state = 'loading', message = 'Connecting to your account…';
  let conflict = false, signedOut = false, blocked = false, running = false, leaving = false;
  let cacheAvailable = true, retryTimer = null, retryDelay = 5000;

  const bar = document.createElement('div');
  bar.className = 'cloudbar';
  bar.innerHTML = '<div class="cloudtext"><span class="clouddot" aria-hidden="true"></span><span id="cloudStatus" role="status" aria-live="polite"></span></div><div id="cloudActions"></div>';
  document.querySelector('main').prepend(bar);

  const pendingAny = () => KINDS.some((kind) => pending[kind]);
  const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

  function note() {
    bar.dataset.state = state;
    document.getElementById('cloudStatus').textContent = message;
    for (const id of ['saved', 'storageNote']) {
      const el = document.getElementById(id);
      if (el) el.textContent = message;
    }
  }

  function setStatus(next, text) {
    state = next;
    message = text;
    note();
    renderActions();
  }

  function cache() {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ records, pending }));
      cacheAvailable = true;
    } catch {
      cacheAvailable = false;
    }
  }

  function readCache() {
    try { return parse(localStorage.getItem(cacheKey)); } catch { return null; }
  }

  function clearCache() {
    try { localStorage.removeItem(cacheKey); } catch { /* storage blocked */ }
  }

  function download(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Same { version: 1, fitness, nutrition } format as the original site. */
  function downloadBackup(label = 'backup') {
    download(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        fitness: records.fitness?.value ?? null,
        nutrition: records.nutrition?.value ?? null,
      },
      `benji-daily-plate-${label}-${PlateDate.today()}.json`,
    );
  }

  function offlineText() {
    return cacheAvailable
      ? 'Offline. Your changes are kept on this device and will save when you reconnect.'
      : 'Offline. Keep this tab open and download a backup; this browser cannot store changes.';
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => flush(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }

  async function failure(response) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 409) {
      conflict = true;
      setStatus('conflict', 'Newer changes were saved from another tab or device. Choose how to continue below.');
    } else if (response.status === 401) {
      signedOut = true;
      setStatus('signedout', 'Your session has ended. Sign in again to keep saving. Your changes stay on this device.');
    } else if (response.status === 403) {
      blocked = true;
      setStatus('error', `${body.error || 'This page can no longer save.'} Download a backup, then reload.`);
    } else if (response.status === 400 || response.status === 413 || response.status === 415) {
      const detail = Array.isArray(body.issues) && body.issues.length ? ` (${body.issues[0]})` : '';
      setStatus('error', `Not saved: ${body.error || 'the server rejected this change'}${detail}. Fix the value or download a backup.`);
    } else {
      setStatus('error', 'Cloud storage is unavailable right now. Your changes are kept on this device and will retry.');
      scheduleRetry();
    }
  }

  async function flush() {
    if (conflict || signedOut || blocked || running || !pendingAny()) return;
    running = true;
    clearTimeout(retryTimer);
    try {
      for (;;) {
        const kind = KINDS.find((k) => pending[k]);
        if (!kind) break;
        const snapshot = JSON.stringify(records[kind].value);
        const revision = records[kind].revision;
        setStatus('saving', 'Saving…');
        let response;
        try {
          response = await fetch('/api/progress', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user, kind, revision, value: JSON.parse(snapshot) }),
            signal: AbortSignal.timeout(15000),
          });
        } catch {
          setStatus('offline', navigator.onLine ? 'Could not reach your account. Your changes are kept on this device and will retry.' : offlineText());
          if (navigator.onLine) scheduleRetry();
          return;
        }
        if (!response.ok) {
          await failure(response);
          return;
        }
        records[kind].revision = (await response.json()).revision;
        // If the value changed while this request was in flight, save again.
        if (JSON.stringify(records[kind].value) === snapshot) pending[kind] = false;
        cache();
      }
      retryDelay = 5000;
      setStatus('saved', 'All changes saved to your account.');
    } finally {
      running = false;
    }
  }

  async function fetchCloud() {
    try {
      const response = await fetch('/api/progress', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) return { status: response.status };
      return { status: 200, body: await response.json() };
    } catch {
      return { status: 0 };
    }
  }

  /** Keep the newest saved data and add this tab's new entries where they don't clash. */
  async function mergeIntoLatest() {
    const latest = await fetchCloud();
    if (latest.status !== 200) return setStatus('conflict', 'Could not reach your account. Try again when you are online.');
    downloadBackup('this-tab-before-merge');
    let differences = 0;
    for (const kind of KINDS) {
      const cloud = latest.body.records[kind];
      if (pending[kind]) {
        const merged = PlateMerge(kind, cloud?.value, records[kind].value);
        differences += merged.conflicts;
        records[kind] = { value: merged.value, revision: cloud?.revision || 0 };
      } else if (cloud) {
        records[kind] = cloud;
      }
    }
    conflict = false;
    cache();
    await flush();
    if (!pendingAny()) {
      notice(differences
        ? `Merged and saved. ${differences} value(s) differed; the newer saved values were kept. This tab’s version was downloaded first.`
        : 'Merged and saved. Nothing was lost.');
      reloadPage();
    }
  }

  /** A message to show after the next reload of this tab. */
  function notice(text) {
    try { sessionStorage.setItem('plateNotice', text); } catch { /* storage blocked */ }
  }

  function takeNotice() {
    try {
      const text = sessionStorage.getItem('plateNotice');
      sessionStorage.removeItem('plateNotice');
      return text;
    } catch {
      return null;
    }
  }

  function discardAndReload() {
    if (!confirm('Load the latest saved records and drop this tab’s unsaved changes? A copy of this tab’s version will download first.')) return;
    downloadBackup('this-tab-discarded');
    clearCache();
    reloadPage();
  }

  function reloadPage() {
    leaving = true;
    location.reload();
  }

  function button(label, onClick, kind = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (kind) b.className = kind;
    b.onclick = onClick;
    return b;
  }

  function renderActions() {
    const el = document.getElementById('cloudActions');
    el.replaceChildren();
    if (state === 'loading') return;

    if (conflict) {
      el.append(
        button('Merge my changes into the latest', mergeIntoLatest, 'strong'),
        button('Load latest, drop my changes', discardAndReload),
      );
    }
    if (signedOut) {
      const a = document.createElement('a');
      a.href = `/login?next=${encodeURIComponent(here)}`;
      a.textContent = 'Sign in again';
      a.className = 'strong';
      el.append(a);
    }
    if (blocked) el.append(button('Reload', reloadPage, 'strong'));
    if ((state === 'error' || state === 'offline') && !blocked) el.append(button('Retry now', () => { retryDelay = 5000; flush(); }));

    if (records.fitness || records.nutrition) el.append(button('Download backup', () => downloadBackup()));
    if (globalThis.PlateImport && !conflict && !signedOut && !blocked) {
      el.append(button('Import backup', () => PlateImport.pick()));
    }

    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/auth/signout';
    form.onsubmit = (event) => {
      if (pendingAny() && !confirm('Some changes have not reached your account yet. Sign out anyway? They stay on this device for this account.')) {
        event.preventDefault();
        return;
      }
      if (!pendingAny()) clearCache(); // nothing unsaved: leave no personal data behind
      leaving = true;
    };
    const out = button('Sign out', null);
    out.type = 'submit';
    out.title = email ? `Signed in as ${email}` : '';
    form.append(out);
    el.append(form);
  }

  globalThis.PlateStorage = {
    getItem(key) {
      const record = records[KEYS[key]];
      return record ? JSON.stringify(record.value) : null;
    },
    setItem(key, text) {
      const kind = KEYS[key];
      if (!kind) return;
      const value = JSON.parse(text);
      if (JSON.stringify(records[kind]?.value) === JSON.stringify(value)) return;
      records[kind] = { value, revision: records[kind]?.revision || 0 };
      pending[kind] = true;
      cache();
      if (conflict || signedOut || blocked) return note();
      if (!navigator.onLine) return setStatus('offline', offlineText());
      flush();
    },
  };

  globalThis.PlateCloud = {
    refreshStatus: note,
    downloadBackup,
    current: (kind) => records[kind]?.value,
    canImport: () => !conflict && !signedOut && !blocked && !running,
    /** Saves imported values and reports whether the server accepted them. */
    async applyImport(values) {
      for (const [kind, value] of Object.entries(values)) {
        records[kind] = { value, revision: records[kind]?.revision || 0 };
        pending[kind] = true;
      }
      cache();
      await flush();
      return { ok: !pendingAny(), message };
    },
    reload: reloadPage,
  };

  function blockPage(text, actions) {
    document.body.classList.add('plate-blocked');
    setStatus('error', text);
    const el = document.getElementById('cloudActions');
    el.replaceChildren(...actions);
  }

  async function start() {
    if (!user) {
      location.href = `/login?next=${encodeURIComponent(here)}`;
      return;
    }
    const cached = readCache();
    const cloud = await fetchCloud();

    if (cloud.status === 200) {
      if (cloud.body.userId !== user) {
        return blockPage('You signed in with a different account in another tab. Reload this page.', [button('Reload', reloadPage, 'strong')]);
      }
      records = cloud.body.records;
      if (cached?.records && cached?.pending) {
        for (const kind of KINDS) {
          if (cached.pending[kind] && cached.records[kind]) {
            // Unsaved edits from an earlier visit. If the account moved on since, ask.
            if ((records[kind]?.revision || 0) !== cached.records[kind].revision) conflict = true;
            records[kind] = cached.records[kind];
            pending[kind] = true;
          }
        }
      }
      const shown = takeNotice();
      if (conflict) setStatus('conflict', 'This device has unsaved changes, and newer changes were saved elsewhere. Choose how to continue below.');
      else if (pendingAny()) setStatus('saving', 'Saving changes made earlier on this device…');
      else setStatus('saved', shown || (records.fitness || records.nutrition ? 'All changes saved to your account.' : 'Connected to your private account. Nothing saved yet.'));
    } else if (cached?.records) {
      records = cached.records;
      pending = cached.pending || {};
      if (cloud.status === 401) {
        signedOut = true;
        setStatus('signedout', 'Your session has ended. Showing the copy on this device; sign in again to keep saving.');
      } else {
        setStatus('offline', 'Can’t reach your account right now. Showing the copy saved on this device; changes will save when the connection returns.');
        scheduleRetry();
      }
    } else {
      // Starting from an empty copy could later overwrite the account, so stop here.
      const retry = button('Try again', reloadPage, 'strong');
      if (cloud.status === 401) {
        const a = document.createElement('a');
        a.href = `/login?next=${encodeURIComponent(here)}`;
        a.textContent = 'Sign in';
        a.className = 'strong';
        return blockPage('Your session has ended. Sign in again to see your records.', [a]);
      }
      return blockPage('Could not load your records. Check your connection and try again.', [retry]);
    }

    cache();
    for (const src of scripts) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.body.append(s);
      });
    }
    renderActions();
    note();
    if (pendingAny() && !conflict && !signedOut) flush();
  }

  addEventListener('online', () => flush());
  addEventListener('offline', () => { if (!running) setStatus('offline', offlineText()); });
  addEventListener('beforeunload', (event) => {
    if (!leaving && (running || pendingAny())) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  addEventListener('pageshow', (event) => { if (event.persisted) reloadPage(); });
  // Pick up changes made on another device when coming back to this tab.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || state !== 'saved' || running || pendingAny()) return;
    const latest = await fetchCloud();
    if (latest.status !== 200 || running || pendingAny()) return;
    const changed = KINDS.some((kind) => (latest.body.records[kind]?.revision || 0) !== (records[kind]?.revision || 0));
    if (changed) reloadPage();
  });

  start().catch(() => blockPage('Could not load the app. Please reload.', [button('Reload', reloadPage, 'strong')]));
})();
