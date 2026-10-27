import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/plate/dates.js';
import '../public/plate/insights.js';

const I = globalThis.Insights;

// Monday = index 0, matching PlateDate.weekday. 2026-10-26 is a Monday.
const training = [
  ['Upper heavy', [['Barbell bench press', 3, '5–7', 180], ['Pull-ups', 3, '6–8', 90]]],
  ['Lower heavy', [['Barbell back squat', 3, '5–7', 180]]],
  ['Active recovery', []],
  ['Push', [['Incline dumbbell press', 3, '8–10', 120]]],
  ['Pull', [['Wide-grip lat pulldown', 3, '10–12', 90]]],
  ['Legs', [['Walking lunges', 3, '10 / leg', null]]],
  ['Full recovery', []],
];
const day = (sets = {}, extra = {}) => ({ meals: [], sets, walk: 0, sleep: 0, recovery: false, note: '', ...extra });

test('trend smooths weigh-ins and lets gaps catch up faster', () => {
  const t = I.trend({ '2026-10-01': 90, '2026-10-02': 88, '2026-10-12': 88 });
  assert.deepEqual(t[0], ['2026-10-01', 90]);
  assert.equal(t[1][1], 89.8); // one day moves 10% of the way
  assert.ok(t[2][1] < 88.8 && t[2][1] > 88); // a 10-day gap moves ~65%
  assert.deepEqual(I.trend({}), []);
});

test('weekly rate needs a week of data', () => {
  assert.equal(I.weeklyRate(I.trend({ '2026-10-01': 90, '2026-10-03': 89 })), null);
  const rate = I.weeklyRate([['2026-10-01', 90], ['2026-10-15', 89]]);
  assert.equal(rate, -0.5);
});

test('sessions map set keys to exercises by weekday and skip empty or recovery days', () => {
  const logs = {
    '2026-10-19': day({ '0-0': { kg: 80, reps: 6 }, '0-1': { kg: 80, reps: 5 }, '1-0': { kg: 0, reps: 8 } }),
    '2026-10-26': day({ '0-0': { kg: 82.5, reps: 5 }, '0-1': { kg: null, reps: null } }),
    '2026-10-20': day({ '0-0': { kg: 100, reps: 5 } }, { recovery: true }),
  };
  const bench = I.sessions(logs, training, 'Barbell bench press');
  assert.deepEqual(bench.map((s) => s.date), ['2026-10-19', '2026-10-26']);
  assert.deepEqual(bench[1].sets, [{ kg: 82.5, reps: 5 }]);
  assert.deepEqual(I.sessions(logs, training, 'Pull-ups')[0].sets, [{ kg: 0, reps: 8 }]);
  assert.deepEqual(I.sessions(logs, training, 'Barbell back squat'), []);
});

test('records and PR detection', () => {
  const list = [{ date: '2026-10-19', sets: [{ kg: 80, reps: 6 }, { kg: 80, reps: 5 }] }];
  const r = I.records(list);
  assert.equal(r.e1rm.value, 96);
  assert.deepEqual(r.heaviest, { kg: 80, reps: 6, date: '2026-10-19' });
  assert.equal(r.volume.value, 880);
  assert.equal(I.isRecord({ kg: 82.5, reps: 5 }, r), true); // est. 96.25 kg beats 96
});

test('a heavier set with a higher estimated max is a record; the first session is not', () => {
  const r = I.records([{ date: '2026-10-19', sets: [{ kg: 80, reps: 6 }] }]);
  assert.equal(I.isRecord({ kg: 85, reps: 5 }, r), true);
  assert.equal(I.isRecord({ kg: 80, reps: 6 }, r), false);
  assert.equal(I.isRecord({ kg: 85, reps: 5 }, I.records([])), false);
  assert.equal(I.isRecord({ kg: null, reps: 5 }, r), false);
  const bw = I.records([{ date: '2026-10-19', sets: [{ kg: 0, reps: 8 }] }]);
  assert.equal(I.isRecord({ kg: 0, reps: 9 }, bw), true);
});

test('next target uses double progression', () => {
  const bench = training[0][1][0];
  const done = { sets: [{ kg: 80, reps: 7 }, { kg: 80, reps: 7 }, { kg: 80, reps: 7 }] };
  assert.equal(I.nextTarget(bench, done).kg, 82.5);
  assert.equal(I.nextTarget(bench, done).increase, true);
  const partial = { sets: [{ kg: 80, reps: 7 }, { kg: 80, reps: 6 }, { kg: 80, reps: 5 }] };
  assert.match(I.nextTarget(bench, partial).text, /Stay at 80 kg and work up to 7 reps/);
  const db = training[3][1][0];
  assert.equal(I.nextTarget(db, { sets: [{ kg: 20, reps: 10 }, { kg: 20, reps: 10 }, { kg: 20, reps: 10 }] }).kg, 22);
  assert.match(I.nextTarget(training[5][1][0], { sets: [{ kg: 0, reps: 10 }] }).text, /Beat 10 reps/);
  assert.equal(I.nextTarget(bench, undefined), null);
  assert.deepEqual(I.repRange('10 / leg'), [10, 10]);
  assert.deepEqual(I.repRange('12–15 / arm'), [12, 15]);
});

test('streak counts consecutive logged days and keeps an open today', () => {
  const fitness = { profile: { walk: 90 }, weights: { '2026-10-24': 87 }, logs: { '2026-10-25': day({}, { walk: 30 }) } };
  const nutrition = { goals: [2100, 185, 185, 70], days: { '2026-10-23': [{ id: 'a', food: ['Egg', 155, 12.6, 1.1, 10.6], grams: 100, meal: 'Breakfast' }], '2026-10-20': [] } };
  assert.deepEqual(I.streak(fitness, nutrition, '2026-10-26'), { current: 3, best: 3, todayDone: false });
  fitness.logs['2026-10-26'] = day({}, { note: 'felt good' });
  assert.deepEqual(I.streak(fitness, nutrition, '2026-10-26'), { current: 4, best: 4, todayDone: true });
  assert.equal(I.streak(fitness, nutrition, '2026-10-30').current, 0);
  assert.equal(I.streak(fitness, nutrition, '2026-10-30').best, 4);
});

test('week grid and weekly review use only logged days', () => {
  const fitness = {
    profile: { walk: 60 },
    weights: { '2026-10-18': 88, '2026-10-26': 87 },
    logs: {
      '2026-10-26': day({ '0-0': { kg: 80, reps: 6, done: true } }, { walk: 60, sleep: 7 }),
      '2026-10-27': day({}, { recovery: true, sleep: 8 }),
    },
  };
  const nutrition = { days: { '2026-10-26': [{ id: 'a', food: ['Chicken', 165, 31, 0, 3.6], grams: 600, meal: 'Lunch' }] } };
  const wk = I.week(fitness, nutrition, training, [2100, 185, 185, 70], '2026-10-28');
  assert.equal(wk[0].date, '2026-10-26');
  assert.deepEqual([wk[0].trained, wk[0].protein, wk[0].walked], [true, true, true]);
  assert.equal(wk[1].rest, true); // recovery switched on
  assert.equal(wk[2].rest, true); // planned recovery day

  const r = I.review(fitness, nutrition, training, '2026-10-27');
  assert.equal(r.workouts, 1);
  assert.equal(r.planned, 4); // Thu, Fri, Sat, Mon (Wed and Sun are rest; Tue switched to recovery)
  assert.equal(r.foodDays, 1);
  assert.equal(Math.round(r.protein), 186);
  assert.equal(r.sleep, 7.5);
  assert.equal(r.walk, 60);
  assert.ok(r.trendChange < 0);
});
