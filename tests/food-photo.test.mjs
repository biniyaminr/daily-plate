import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePhoto, AnalysisError, cleanAnalysis, DAILY_PHOTO_LIMIT } from '../lib/food/analyze.ts';

const ORIGIN = 'https://enjera.test';
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD=';
const req = (body, origin = ORIGIN) =>
  new Request(`${ORIGIN}/api/food/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
const item = (over = {}) => ({
  name: 'Shiro wot', local_name: 'ሽሮ ወጥ', grams: 150, kcal_per_100g: 140, protein_per_100g: 6,
  carbs_per_100g: 16, fat_per_100g: 6, confidence: 'medium', portion_note: 'one ladle', ...over,
});
const meal = { is_food: true, meal_summary: 'Shiro with injera.', items: [item(), item({ name: 'Injera', grams: 130 })], tips: ['Add gomen.'] };

function deps(over = {}) {
  const calls = { quota: 0, analyze: [] };
  return {
    calls,
    getUserId: async () => 'user-1',
    configured: true,
    useQuota: async (limit) => { calls.quota++; assert.equal(limit, DAILY_PHOTO_LIMIT); return true; },
    analyze: async (r) => { calls.analyze.push(r); return meal; },
    ...over,
  };
}

test('a signed-in photo request returns the cleaned analysis', async () => {
  const d = deps();
  const res = await analyzePhoto(req({ image: PHOTO, note: ' half injera ', goal: 'lose' }), d);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const { analysis } = await res.json();
  assert.equal(analysis.items.length, 2);
  assert.equal(d.calls.quota, 1);
  assert.equal(d.calls.analyze[0].note, 'half injera');
  assert.equal(d.calls.analyze[0].goal, 'lose');
});

test('refuses other origins, bad images, signed-out users, and an unconfigured server before any paid call', async () => {
  const d = deps();
  assert.equal((await analyzePhoto(req({ image: PHOTO }, 'https://evil.test'), d)).status, 403);
  assert.equal((await analyzePhoto(req({ image: 'data:image/gif;base64,R0lG' }), d)).status, 400);
  assert.equal((await analyzePhoto(req({ image: 'https://example.com/x.jpg' }), d)).status, 400);
  assert.equal((await analyzePhoto(req({ image: PHOTO }), deps({ getUserId: async () => null }))).status, 401);
  assert.equal((await analyzePhoto(req({ image: PHOTO }), deps({ configured: false }))).status, 503);
  assert.equal(d.calls.quota, 0);
  assert.equal(d.calls.analyze.length, 0);
});

test('the daily limit stops the model call', async () => {
  const d = deps({ useQuota: async () => false });
  const res = await analyzePhoto(req({ image: PHOTO }), d);
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /today’s 20 photo analyses/);
  assert.equal(d.calls.analyze.length, 0);
  assert.equal((await analyzePhoto(req({ image: PHOTO }), deps({ useQuota: async () => { throw new Error('missing function'); } }))).status, 503);
});

test('model failures map to clear responses', async () => {
  const busy = deps({ analyze: async () => { throw new AnalysisError('busy', 'Busy.'); } });
  assert.equal((await analyzePhoto(req({ image: PHOTO }), busy)).status, 503);
  const declined = deps({ analyze: async () => { throw new AnalysisError('declined', 'No.'); } });
  assert.equal((await analyzePhoto(req({ image: PHOTO }), declined)).status, 422);
  const crash = deps({ analyze: async () => { throw new Error('boom'); } });
  const res = await analyzePhoto(req({ image: PHOTO }), crash);
  assert.equal(res.status, 502);
  assert.doesNotMatch((await res.json()).error, /boom/);
});

test('estimates are clamped to the food log limits', () => {
  const out = cleanAnalysis({
    is_food: true, meal_summary: ' x ', tips: ['a', 'b', 'c'],
    items: [item({ grams: 9000, kcal_per_100g: 4000, protein_per_100g: -3, fat_per_100g: Number.NaN, name: '  ' })],
  });
  assert.deepEqual(
    [out.items[0].grams, out.items[0].kcal_per_100g, out.items[0].protein_per_100g, out.items[0].fat_per_100g, out.items[0].name],
    [5000, 1000, 0, 0, 'Food'],
  );
  assert.equal(out.tips.length, 2);
  assert.equal(cleanAnalysis({ ...meal, is_food: false }).items.length, 0);
  assert.equal(cleanAnalysis({ ...meal, items: [] }).is_food, false);
});
