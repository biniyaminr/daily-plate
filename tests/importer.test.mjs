import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/plate/merge.js';
import '../public/plate/importer.js';

const { summarize } = globalThis.PlateImport;

const fitness = () => ({
  profile: { weight: 87, height: 175, start: '2026-10-22', walk: 90 },
  weights: { '2026-10-22': 87, '2026-10-29': 86.4 },
  logs: { '2026-10-22': { meals: [true], sets: {}, walk: 90, sleep: 7.5, recovery: false, note: 'Day one' } },
});

test('first import into an empty account adds everything', () => {
  const s = summarize('fitness', undefined, fitness());
  assert.equal(s.newWeighIns, 2);
  assert.equal(s.newDays, 1);
  assert.equal(s.conflicts, 0);
  assert.equal(s.range, '2026-10-22 to 2026-10-29');
  assert.equal(s.changes, true);
});

test('re-importing the same backup changes nothing', () => {
  const current = fitness();
  const s = summarize('fitness', current, fitness());
  assert.equal(s.newWeighIns, 0);
  assert.equal(s.newDays, 0);
  assert.equal(s.changes, false);
});

test('conflicting values are reported and the account value is kept', () => {
  const current = fitness();
  const backup = fitness();
  backup.weights['2026-10-29'] = 85.9; // differs
  backup.weights['2026-11-05'] = 85.5; // new
  const s = summarize('fitness', current, backup);
  assert.equal(s.conflicts, 1);
  assert.equal(s.newWeighIns, 1);
  assert.equal(s.merged.weights['2026-10-29'], 86.4);
  assert.equal(s.merged.weights['2026-11-05'], 85.5);
});

test('nutrition counts new food entries by id, without duplicates', () => {
  const row = (id, grams = 100) => ({ id, food: ['Egg · boiled', 155, 12.6, 1.1, 10.6], grams, meal: 'Breakfast' });
  const current = { goals: [2100, 185, 185, 70], days: { '2026-10-22': [row('a')] } };
  const backup = { goals: [2100, 185, 185, 70], days: { '2026-10-22': [row('a'), row('b')], '2026-10-23': [row('c')], '2026-10-24': [] } };
  const s = summarize('nutrition', current, backup);
  assert.equal(s.rows, 3);
  assert.equal(s.newRows, 2);
  assert.equal(s.days, 2, 'empty days are not counted');
  assert.equal(s.merged.days['2026-10-22'].length, 2);
  const again = summarize('nutrition', s.merged, backup);
  assert.equal(again.newRows, 0);
  assert.equal(again.changes, false);
});

test('differences names each clashing value for the preview', () => {
  const current = fitness();
  current.profile.start = '2026-10-26'; // default created before importing
  const backup = fitness();
  backup.weights['2026-10-29'] = 85.9;
  const diffs = globalThis.PlateImport.differences('fitness', current, backup);
  assert.deepEqual(diffs.map((d) => d.label), ['program start date', 'weigh-in 2026-10-29']);
  assert.equal(diffs[0].account, '2026-10-26');
  assert.equal(diffs[0].backup, '2026-10-22');
  assert.deepEqual(globalThis.PlateImport.differences('fitness', undefined, backup), []);
});
