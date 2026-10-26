// Adapted from the original tests-import.mjs: same merge assertions, run with node:test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/plate/merge.js';

const merge = globalThis.PlateMerge;

test('merge: full first import, non-destructive merging, conflicts, no mutation', () => {
  const local = { profile: { weight: 87, height: 175, start: '2026-10-18', walk: 90 }, logs: { '2026-10-21': { meals: [true], sets: { '0-0': { kg: 60, reps: 7, done: true } }, walk: 60, sleep: 8, recovery: false, note: 'Great' } }, weights: { '2026-10-21': 86.5 } };
  assert.deepEqual(merge('fitness', undefined, local), { value: local, conflicts: 0 });

  const cloud = structuredClone(local);
  cloud.weights['2026-10-22'] = 86;
  cloud.logs['2026-10-21'].sets['0-1'] = { kg: 60, reps: 6 };
  cloud.logs['2026-10-21'].note = 'Cloud note';
  const original = JSON.stringify({ cloud, local });
  const result = merge('fitness', cloud, local);
  assert.equal(result.conflicts, 1);
  assert.equal(result.value.logs['2026-10-21'].note, 'Cloud note');
  assert.equal(result.value.weights['2026-10-22'], 86);
  assert.deepEqual(result.value.logs['2026-10-21'].sets['0-1'], { kg: 60, reps: 6 });
  assert.equal(JSON.stringify({ cloud, local }), original, 'Neither original is mutated');

  const holes = structuredClone(local);
  holes.logs['2026-10-21'].meals = [null, null, true];
  assert.deepEqual(merge('fitness', local, holes).value.logs['2026-10-21'].meals, [true, null, true]);
});

test('merge: nutrition rows dedupe by id and existing entries win', () => {
  const row = { id: 'one', food: ['Egg', 155, 12.6, 1.1, 10.6], grams: 100, meal: 'Breakfast' };
  const n = { goals: [2100, 185, 185, 70], days: { '2026-10-22': [row] } };
  const more = structuredClone(n);
  more.days['2026-10-22'].push({ ...row, id: 'two' });
  more.days['2026-10-23'] = [{ ...row, id: 'three' }];
  const combined = merge('nutrition', n, more);
  assert.equal(combined.conflicts, 0);
  assert.equal(combined.value.days['2026-10-22'].length, 2);
  assert.equal(combined.value.days['2026-10-23'].length, 1);
  assert.deepEqual(merge('nutrition', combined.value, more).value, combined.value, 'Repeated imports do not duplicate rows');
  more.days['2026-10-22'][0].grams = 200;
  assert.equal(merge('nutrition', n, more).conflicts, 1);
  assert.equal(merge('nutrition', n, more).value.days['2026-10-22'][0].grams, 100, 'Existing cloud entries survive conflicting imports');
});
