import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/plate/dates.js';
import '../public/plate/insights.js';

const I = globalThis.Insights;
const training = [
  ['Upper', [['Barbell bench press', 3, '5–7', 180]]],
  ['Lower', [['Barbell back squat', 3, '5–7', 180]]],
  ['Rest', []], ['Push', [['Incline dumbbell press', 3, '8–10', 120]]], ['Pull', [['Wide-grip lat pulldown', 3, '10–12', 90]]],
  ['Legs', [['Goblet squat', 3, '8–10', 90]]], ['Rest', []],
];
const day = (sets = {}, extra = {}) => ({ meals: [], sets, walk: 0, sleep: 0, recovery: false, note: '', ...extra });

test('periods: Monday weeks, calendar months, calendar years, and shifting', () => {
  assert.deepEqual(I.period('week', '2026-10-28'), { kind: 'week', from: '2026-10-26', to: '2026-11-01', label: '2026-10-26 to 2026-11-01' });
  assert.equal(I.period('week', '2026-10-28', -1).from, '2026-10-19');
  assert.deepEqual(I.period('month', '2026-02-10'), { kind: 'month', from: '2026-02-01', to: '2026-02-28', label: 'February 2026' });
  assert.equal(I.period('month', '2026-01-15', -1).label, 'December 2025');
  assert.equal(I.period('month', '2028-02-01').to, '2028-02-29');
  assert.deepEqual(I.period('year', '2026-10-28', -1), { kind: 'year', from: '2025-01-01', to: '2025-12-31', label: '2025' });
});

test('report totals work done and body change, ignoring days after today', () => {
  const fitness = {
    profile: { weight: 90, walk: 60 },
    weights: { '2026-10-18': 90, '2026-10-26': 89, '2026-10-30': 88 },
    logs: {
      '2026-10-19': day({ '0-0': { kg: 80, reps: 5, done: true } }),
      '2026-10-26': day({ '0-0': { kg: 85, reps: 5, done: true }, '0-1': { kg: 80, reps: 6 } }, { walk: 40, sleep: 7 }),
      '2026-10-27': day({ '0-0': { kg: 100, reps: 5 } }, { walk: 20, sleep: 8 }),
      '2026-10-30': day({ '0-0': { kg: 50, reps: 10 } }),
    },
  };
  const nutrition = { days: { '2026-10-26': [{ id: 'a', food: ['Chicken', 165, 31, 0, 3.6], grams: 600, meal: 'Lunch' }] } };
  const p = I.period('week', '2026-10-28');
  const r = I.report(fitness, nutrition, training, [2100, 185, 185, 70], p, '2026-10-28');
  assert.equal(r.days, 3); // Mon to Wed so far
  assert.equal(r.workouts, 2);
  assert.equal(r.planned, 2); // Mon, Tue (Wed is rest)
  assert.equal(r.sets, 3);
  assert.equal(r.volume, 85 * 5 + 80 * 6 + 100 * 5);
  assert.equal(r.buckets[0].volume, 905);
  assert.equal(r.walkAvg, 30);
  assert.equal(r.sleepAvg, 7.5);
  assert.equal(r.foodDays, 1);
  assert.equal(r.proteinDays, 1);
  assert.equal(r.weighIns, 1); // the 30th is in the future
  assert.ok(r.weightChange < 0);
  assert.equal(r.bestStreak, 2);
  assert.equal(r.prs, 1); // 85 × 5 beat 80 × 5; Tuesday's squat is the first squat session
  const bench = r.lifts.find((l) => l.name === 'Barbell bench press');
  assert.equal(bench.sessions, 1);
  assert.ok(bench.change > 0);
  assert.equal(r.lifts.find((l) => l.name === 'Barbell back squat').before, null);
});

test('year reports bucket by month', () => {
  const fitness = { profile: { weight: 80 }, weights: {}, logs: { '2026-03-02': day({ '0-0': { kg: 60, reps: 10 } }) } };
  const r = I.report(fitness, null, training, [2000, 150, 200, 60], I.period('year', '2026-06-01'), '2026-12-31');
  assert.equal(r.buckets.length, 12);
  assert.equal(r.buckets[2].label, 'Mar');
  assert.equal(r.buckets[2].volume, 600);
  assert.equal(r.from, '2026-03-02'); // counts from the first record
  assert.equal(r.days, 305);
  assert.equal(r.weightChange, null);
  const started = { ...fitness, profile: { weight: 80, start: '2026-01-10' } };
  assert.equal(I.report(started, null, training, [2000, 150, 200, 60], I.period('year', '2026-06-01'), '2026-12-31').from, '2026-01-10');
});
