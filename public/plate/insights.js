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

  globalThis.Insights = { trend, weeklyRate, e1rm, sessions, records, isRecord, repRange, nextTarget, streak, week, review, active };
})();
