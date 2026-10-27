import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/plate/plans.js';

const { targets, day, fastingDay, FOODS } = globalThis.Plans;
const person = { sex: 'female', age: 30, height: 162, weight: 75, activity: 'light' };

test('targets follow the goal: deficit to lose, surplus to gain', () => {
  const lose = targets({ ...person, goal: 'lose' });
  const keep = targets({ ...person, goal: 'maintain' });
  const gain = targets({ ...person, goal: 'gain' });
  assert.equal(lose.bmr, 1452); // Mifflin-St Jeor: 750 + 1012.5 - 150 - 161
  assert.ok(lose.kcal < keep.kcal && keep.kcal < gain.kcal);
  assert.equal(keep.kcal % 50, 0);
  for (const t of [lose, keep, gain]) {
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    assert.ok(Math.abs(fromMacros - t.kcal) <= 40, `${fromMacros} vs ${t.kcal}`);
  }
});

test('calories never drop below a safe floor, and protein uses a healthy reference weight', () => {
  const small = targets({ sex: 'female', age: 60, height: 150, weight: 45, activity: 'sedentary', goal: 'lose' });
  assert.equal(small.kcal, 1200);
  const heavy = targets({ sex: 'male', age: 40, height: 170, weight: 140, activity: 'sedentary', goal: 'lose' });
  assert.ok(heavy.protein <= 2 * 27 * 1.7 ** 2); // not 1.8 g × 140 kg
});

test('every generated day lands near the calorie target', () => {
  for (const goal of ['lose', 'gain', 'recomp', 'maintain']) {
    const t = targets({ ...person, goal });
    for (const fasting of ['none', 'all']) {
      for (let d = 0; d < 7; d++) {
        const plan = day(d, t, fasting);
        assert.equal(plan.meals.length, 5);
        const off = Math.abs(plan.totals[0] - t.kcal) / t.kcal;
        assert.ok(off < 0.12, `${goal} ${fasting} day ${d}: ${Math.round(plan.totals[0])} vs ${t.kcal}`);
      }
    }
  }
});

test('non-fasting days get close to the protein target', () => {
  const t = targets({ ...person, goal: 'recomp' });
  for (let d = 0; d < 7; d++) assert.ok(day(d, t).totals[1] >= t.protein * 0.9);
});

test('fasting days have no animal foods and follow the chosen days', () => {
  const animal = ['egg', 'eggWhite', 'doro', 'tibs', 'asa', 'ayib', 'ergo'];
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].filter((d) => fastingDay('wedfri', d)), [2, 4]);
  const t = targets({ ...person, goal: 'maintain' });
  const wed = day(2, t, 'wedfri');
  assert.equal(wed.fasting, true);
  assert.ok(wed.meals.every((m) => m.items.every((i) => !animal.includes(i.key))));
  assert.equal(day(1, t, 'wedfri').fasting, false);
});

test('portions are written in practical units', () => {
  const plan = day(0, targets({ sex: 'male', age: 25, height: 180, weight: 70, activity: 'active', goal: 'gain' }));
  for (const m of plan.meals) {
    for (const i of m.items) {
      if (i.key === 'injera') assert.equal(i.amount % 0.5, 0);
      else if (FOODS[i.key][5]) assert.ok(Number.isInteger(i.amount));
      else assert.equal(i.amount % 5, 0);
    }
  }
  assert.match(plan.meals[1].text, /injera/);
});
