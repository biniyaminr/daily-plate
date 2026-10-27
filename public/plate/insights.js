// Insights worked out from records already logged: a smoothed weight trend,
// lift records with a next-session target, logging streaks and a weekly
// review. Pure functions over the fitness/nutrition JSON; nothing is stored.
(() => {
  const { addDays, daysBetween, weekday } = PlateDate;
  const round = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
  const sorted = (o) => Object.entries(o || {}).sort(([a], [b]) => a.localeCompare(b));

  /** Exponentially smoothed weight (10% per day, gaps decay), one point per weigh-in. */
  function trend(weights) {
    let t = null, prev = null;
    return sorted(weights).map(([d, w]) => {
      w = Number(w);
      t = t === null ? w : t + (1 - 0.9 ** Math.max(1, daysBetween(prev, d))) * (w - t);
      prev = d;
      return [d, round(t, 2)];
    });
  }

  /** Trend change per week over up to the last 14 days; null until 7 days of data. */
  function weeklyRate(points) {
    if (points.length < 2) return null;
    const [end, last] = points.at(-1);
    const from = points.find(([d]) => daysBetween(d, end) <= 14);
    const span = daysBetween(from[0], end);
    return span >= 7 ? round(((last - from[1]) / span) * 7, 2) : null;
  }

  /** Epley estimated one-rep max; bodyweight sets have none. */
  const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : 0);

  /** Every session of one exercise, oldest first: [{ date, sets: [{ kg, reps }] }]. */
  function sessions(logs, training, name) {
    const out = [];
    for (const [d, log] of sorted(logs)) {
      if (log.recovery) continue;
      const i = training[weekday(d)][1].findIndex((ex) => ex[0] === name);
      if (i < 0) continue;
      const sets = Object.entries(log.sets || {})
        .filter(([k, v]) => k.startsWith(`${i}-`) && v.reps > 0 && v.kg != null)
        .sort(([a], [b]) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
        .map(([, v]) => ({ kg: Number(v.kg), reps: Number(v.reps) }));
      if (sets.length) out.push({ date: d, sets });
    }
    return out;
  }

  /** Best estimated 1RM, heaviest set, most reps and best session volume. */
  function records(list) {
    const r = { e1rm: null, heaviest: null, reps: null, volume: null };
    for (const { date, sets } of list) {
      let volume = 0;
      for (const { kg, reps } of sets) {
        volume += kg * reps;
        const est = e1rm(kg, reps);
        if (est && (!r.e1rm || est > r.e1rm.value)) r.e1rm = { value: round(est), kg, reps, date };
        if (kg > 0 && (!r.heaviest || kg > r.heaviest.kg || (kg === r.heaviest.kg && reps > r.heaviest.reps))) r.heaviest = { kg, reps, date };
        if (!r.reps || reps > r.reps.reps) r.reps = { kg, reps, date };
      }
      if (volume && (!r.volume || volume > r.volume.value)) r.volume = { value: round(volume), date };
    }
    return r;
  }

  /** Whether a set beats every earlier session's best (estimated 1RM, or reps at bodyweight). */
  function isRecord(set, before) {
    if (!set || !(set.reps > 0) || set.kg == null) return false;
    const kg = Number(set.kg), reps = Number(set.reps);
    if (!before.e1rm && !before.reps) return false; // first session sets the baseline
    if (kg > 0) return !before.e1rm || e1rm(kg, reps) > before.e1rm.value + 0.05;
    return !before.e1rm && reps > before.reps.reps;
  }

  /** "5–7" → [5, 7]; "10 / leg" → [10, 10]. */
  function repRange(text) {
    const m = String(text).match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
    return m ? [Number(m[1]), Number(m[2] || m[1])] : null;
  }

  /**
   * Double progression: once every planned set reaches the top of the rep
   * range, add the smallest weight step; until then keep the weight and add reps.
   */
  function nextTarget(exercise, last) {
    const range = repRange(exercise[2]);
    if (!last || !range) return null;
    const [lo, hi] = range;
    const top = Math.max(...last.sets.map((s) => s.kg));
    const atTop = last.sets.filter((s) => s.kg === top);
    const reps = exercise[2].replace(/^[\d–\s-]+/, '').trim();
    const unit = reps ? ` ${reps}` : '';
    if (top === 0) {
      return { kg: 0, text: `Beat ${Math.max(...last.sets.map((s) => s.reps))} reps on at least one set`, increase: false };
    }
    const complete = last.sets.length >= exercise[1] && atTop.length >= exercise[1] && atTop.every((s) => s.reps >= hi);
    if (complete) {
      const step = /dumbbell|\bDB\b/i.test(exercise[0]) ? 2 : 2.5;
      return { kg: round(top + step), text: `Try ${round(top + step)} kg for ${lo === hi ? lo : `${lo}–${hi}`}${unit} reps`, increase: true };
    }
    return { kg: top, text: `Stay at ${top} kg and work up to ${hi}${unit} reps on every set`, increase: false };
  }

  const foodRows = (nutrition, d) => nutrition?.days?.[d] || [];
  const totals = (rows) => rows.reduce((t, r) => t.map((x, i) => x + (r.food[i + 1] * r.grams) / 100), [0, 0, 0, 0]);
  const trained = (log) => Object.values(log?.sets || {}).some((s) => s.done || s.reps > 0);

  /** A day counts once anything was logged for it. */
  function active(fitness, nutrition, d) {
    const log = fitness.logs?.[d];
    return Boolean(
      fitness.weights?.[d] != null ||
      foodRows(nutrition, d).length ||
      (log && (trained(log) || log.walk > 0 || log.sleep > 0 || log.recovery || log.note || (log.meals || []).some(Boolean))),
    );
  }

  /** Consecutive logged days up to today (today may still be open), plus the best run. */
  function streak(fitness, nutrition, today) {
    let current = 0;
    let d = active(fitness, nutrition, today) ? today : addDays(today, -1);
    const todayDone = d === today;
    while (active(fitness, nutrition, d)) { current++; d = addDays(d, -1); }

    const dates = [...new Set([...Object.keys(fitness.logs || {}), ...Object.keys(fitness.weights || {}), ...Object.keys(nutrition?.days || {})])]
      .filter((x) => x <= today && active(fitness, nutrition, x)).sort();
    let best = 0, run = 0, prev = null;
    for (const x of dates) {
      run = prev && daysBetween(prev, x) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = x;
    }
    return { current, best: Math.max(best, current), todayDone };
  }

  /** Monday-to-Sunday view of training, protein and walking for the week holding `date`. */
  function week(fitness, nutrition, training, goals, date) {
    const monday = addDays(date, -weekday(date));
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i), log = fitness.logs?.[d];
      const rest = !training[i][1].length || Boolean(log?.recovery);
      return {
        date: d,
        rest,
        trained: trained(log),
        protein: foodRows(nutrition, d).length ? totals(foodRows(nutrition, d))[1] >= goals[1] * 0.9 : false,
        walked: (log?.walk || 0) >= (fitness.profile?.walk || 1),
      };
    });
  }

  /** The seven days ending on `date`: averages over the days that were actually logged. */
  function review(fitness, nutrition, training, date) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
    const fed = days.map((d) => foodRows(nutrition, d)).filter((r) => r.length).map(totals);
    const logs = days.map((d) => fitness.logs?.[d]).filter(Boolean);
    const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const planned = days.filter((d) => training[weekday(d)][1].length && !fitness.logs?.[d]?.recovery).length;
    const t = trend(fitness.weights).filter(([d]) => d <= date);
    const inWeek = t.filter(([d]) => d >= days[0]);
    const before = t.filter(([d]) => d < days[0]).at(-1);
    return {
      foodDays: fed.length,
      kcal: avg(fed.map((x) => x[0])),
      protein: avg(fed.map((x) => x[1])),
      workouts: days.filter((d) => trained(fitness.logs?.[d])).length,
      planned,
      sleep: avg(logs.map((l) => l.sleep).filter((x) => x > 0)),
      walk: avg(logs.map((l) => l.walk).filter((x) => x > 0)),
      trendChange: inWeek.length && before ? round(inWeek.at(-1)[1] - before[1], 2) : null,
    };
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthDays = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

  /** The week (Monday start), month or year holding `anchor`, `shift` periods away. */
  function period(kind, anchor, shift = 0) {
    let [y, m] = anchor.split('-').map(Number);
    if (kind === 'week') {
      const from = addDays(addDays(anchor, -weekday(anchor)), shift * 7), to = addDays(from, 6);
      return { kind, from, to, label: `${from} to ${to}` };
    }
    if (kind === 'month') {
      const index = y * 12 + (m - 1) + shift;
      y = Math.floor(index / 12); m = (index % 12) + 1;
      const mm = String(m).padStart(2, '0');
      return { kind, from: `${y}-${mm}-01`, to: `${y}-${mm}-${monthDays(y, m)}`, label: `${MONTHS[m - 1]} ${y}` };
    }
    y += shift;
    return { kind, from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }

  /**
   * Totals for one period. Days after `today` are ignored, so a period in
   * progress is compared fairly. Weight change uses the smoothed trend.
   */
  function report(fitness, nutrition, training, goals, p, today) {
    const end = p.to < today ? p.to : today;
    const logs = fitness.logs || {};
    const r = {
      days: 0, activeDays: 0, workouts: 0, planned: 0, sets: 0, volume: 0, walk: 0, walkDays: 0, sleep: 0, sleepDays: 0,
      foodDays: 0, kcal: 0, protein: 0, proteinDays: 0, weighIns: 0, bestStreak: 0, prs: 0, buckets: [], lifts: [],
    };
    const bucketOf = (d) => (p.kind === 'year' ? Number(d.slice(5, 7)) - 1 : daysBetween(p.from, d));
    const count = p.kind === 'year' ? 12 : daysBetween(p.from, p.to) + 1;
    r.buckets = Array.from({ length: count }, (_, i) => ({
      label: p.kind === 'year' ? MONTHS[i].slice(0, 3) : p.kind === 'week' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] : String(i + 1),
      workouts: 0, volume: 0,
    }));
    // Days before someone started (their start date or first record, whichever is earlier) don't count.
    const first = [fitness.profile?.start, ...Object.keys(logs), ...Object.keys(fitness.weights || {}), ...Object.keys(nutrition?.days || {})]
      .filter(Boolean).sort()[0];
    r.from = first && first > p.from ? first : p.from;
    let run = 0;
    for (let d = r.from; d <= end; d = addDays(d, 1)) {
      r.days++;
      const log = logs[d], rows = foodRows(nutrition, d), b = r.buckets[bucketOf(d)];
      if (active(fitness, nutrition, d)) { r.activeDays++; run++; r.bestStreak = Math.max(r.bestStreak, run); } else run = 0;
      if (training[weekday(d)][1].length && !log?.recovery) r.planned++;
      if (trained(log)) { r.workouts++; b.workouts++; }
      for (const s of Object.values(log?.sets || {})) {
        if (!(s.done || s.reps > 0)) continue;
        r.sets++;
        const v = (Number(s.kg) || 0) * (Number(s.reps) || 0);
        r.volume += v; b.volume += v;
      }
      if (log?.walk > 0) { r.walk += log.walk; r.walkDays++; }
      if (log?.sleep > 0) { r.sleep += log.sleep; r.sleepDays++; }
      if (rows.length) {
        const t = totals(rows);
        r.foodDays++; r.kcal += t[0]; r.protein += t[1];
        if (t[1] >= goals[1] * 0.9) r.proteinDays++;
      }
      if (fitness.weights?.[d] != null) r.weighIns++;
    }
    r.walkAvg = r.walkDays ? r.walk / r.walkDays : null;
    r.sleepAvg = r.sleepDays ? r.sleep / r.sleepDays : null;
    r.kcalAvg = r.foodDays ? r.kcal / r.foodDays : null;
    r.proteinAvg = r.foodDays ? r.protein / r.foodDays : null;

    const t = trend(fitness.weights).filter(([d]) => d <= end);
    const inside = t.filter(([d]) => d >= p.from);
    const before = t.filter(([d]) => d < p.from).at(-1);
    r.weightStart = before ? before[1] : inside[0]?.[1] ?? null;
    r.weightEnd = inside.at(-1)?.[1] ?? null;
    r.weightChange = r.weightStart != null && r.weightEnd != null && (before || inside.length > 1) ? round(r.weightEnd - r.weightStart, 2) : null;
    r.sinceStart = r.weightEnd != null ? round(r.weightEnd - fitness.profile.weight, 2) : null;

    // Lifts trained in the period: best estimated max now against the best before it.
    for (const name of [...new Set(training.flatMap((x) => x[1].map((e) => e[0])))]) {
      const all = sessions(logs, training, name).filter((x) => x.date <= end);
      const during = all.filter((x) => x.date >= p.from);
      if (!during.length) continue;
      let best = records(all.filter((x) => x.date < p.from));
      const earlier = best.e1rm?.value ?? null;
      for (const sess of during) {
        const prior = all.filter((x) => x.date < sess.date);
        sess.sets.forEach((set, i) => {
          // Count against the best so far, including earlier sets in the same session.
          if (prior.length && isRecord(set, best)) r.prs++; // the first session is the baseline
          best = records([...prior, { date: sess.date, sets: sess.sets.slice(0, i + 1) }]);
        });
      }
      const now = records(during);
      r.lifts.push({ name, sessions: during.length, best: now.heaviest || now.reps, e1rm: now.e1rm?.value ?? null, before: earlier, change: earlier && now.e1rm ? round(now.e1rm.value - earlier, 1) : null });
    }
    r.lifts.sort((a, b) => (b.change ?? -1e9) - (a.change ?? -1e9) || b.sessions - a.sessions);
    return r;
  }

  globalThis.Insights = { trend, weeklyRate, e1rm, sessions, records, isRecord, repRange, nextTarget, streak, week, review, active, period, report };
})();
