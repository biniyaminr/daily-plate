// Adapted from the original tests-progress.mjs. The same scenarios now run the
// real API handler against the real Supabase migration on PostgreSQL, with
// each request executed as the `authenticated` role under row-level security.
// Run via `pnpm test:db` (scripts/test-db.sh sets up the database).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { getProgress, putProgress, validateBackup } from '../../lib/progress/handler.ts';

const pool = new pg.Pool();
after(() => pool.end());

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
await pool.query('insert into auth.users (id, email) values ($1, $2), ($3, $4) on conflict do nothing', [A, 'a@test', B, 'b@test']);

/** Runs fn inside a transaction as the given Supabase user (or anon when null). */
async function as(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** The production store's contract, implemented with SQL instead of supabase-js. */
const pgStore = (userId) => ({
  list: () => as(userId, async (c) => (await c.query('select kind, payload, revision from public.progress')).rows),
  save: (kind, revision, payload) =>
    as(userId, async (c) => (await c.query('select public.save_progress($1, $2, $3::jsonb) as r', [kind, revision, JSON.stringify(payload)])).rows[0].r),
});
const deps = (userId, store = pgStore(userId)) => ({ getUserId: async () => userId, store });

const ORIGIN = 'https://binyam.test';
const req = (user, method = 'GET', body, origin = ORIGIN) =>
  new Request(`${ORIGIN}/api/progress`, {
    method,
    headers: { 'content-type': 'application/json', origin },
    ...(body ? { body: JSON.stringify({ userId: user, ...body }) } : {}),
  });

const fitness = { profile: { weight: 87, height: 175, start: '2026-10-22', walk: 90 }, logs: {}, weights: {} };
const nutrition = { goals: [2100, 185, 185, 70], days: { '2026-10-22': [{ id: 'test-1', food: ['Egg', 155, 12.6, 1.1, 10.6], grams: 100, meal: 'Breakfast' }] } };

test('signed-out requests are refused', async () => {
  assert.equal((await getProgress(deps(null))).status, 401);
  assert.equal((await putProgress(req(null, 'PUT', { kind: 'fitness', revision: 0, value: fitness }), deps(null))).status, 401);
});

test('cross-origin writes and invalid data are refused', async () => {
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 0, value: fitness }, 'https://evil.test'), deps(A))).status, 403);
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 0, value: {} }), deps(A))).status, 400);
  const badDate = structuredClone(fitness);
  badDate.weights['2026-02-30'] = 86;
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 0, value: badDate }), deps(A))).status, 400);
});

test('insert, update, stale-write protection and reload', async () => {
  const first = await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 0, value: fitness }), deps(A));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).revision, 1);

  // Another user sees nothing of A's.
  assert.deepEqual((await (await getProgress(deps(B))).json()).records, {});

  // A second "create" from a stale tab is a conflict, not an overwrite.
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 0, value: fitness }), deps(A))).status, 409);

  const updated = structuredClone(fitness);
  updated.weights['2026-10-22'] = 86.5;
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 1, value: updated }), deps(A))).status, 200);
  // Old tab still holding revision 1:
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 1, value: fitness }), deps(A))).status, 409);

  const saved = await (await getProgress(deps(A))).json();
  assert.equal(saved.userId, A);
  assert.equal(saved.records.fitness.revision, 2);
  assert.equal(saved.records.fitness.value.weights['2026-10-22'], 86.5);
});

test('fitness and nutrition are separate records; users are isolated', async () => {
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'nutrition', revision: 0, value: nutrition }), deps(A))).status, 200);
  // B cannot jump to A's revision numbers, but can create its own record.
  assert.equal((await putProgress(req(B, 'PUT', { kind: 'fitness', revision: 9, value: fitness }), deps(B))).status, 409);
  assert.equal((await putProgress(req(B, 'PUT', { kind: 'fitness', revision: 0, value: fitness }), deps(B))).status, 200);
  // A page loaded for A cannot write while the session belongs to B.
  assert.equal((await putProgress(req(B, 'PUT', { userId: A, kind: 'nutrition', revision: 0, value: nutrition }), deps(B))).status, 403);
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'nutrition', revision: 1, value: { ...nutrition, goals: [-1, 1, 1, 1] } }), deps(A))).status, 400);

  const a = await (await getProgress(deps(A))).json();
  assert.equal(a.records.nutrition.revision, 1);
  assert.deepEqual(a.records.nutrition.value, nutrition);
  const b = await (await getProgress(deps(B))).json();
  assert.deepEqual(Object.keys(b.records), ['fitness']);
  assert.equal(b.records.fitness.revision, 1, "B's record is independent of A's");
});

test('oversized bodies, unavailable storage and caching headers', async () => {
  const large = req(A, 'PUT', { kind: 'fitness', revision: 2, value: 'x'.repeat(2_000_001) });
  assert.equal((await putProgress(large, deps(A))).status, 413);
  assert.equal((await getProgress(deps(A, null))).status, 503);
  const failing = { list: async () => { throw new Error('down'); }, save: async () => { throw new Error('down'); } };
  assert.equal((await getProgress(deps(A, failing))).status, 503);
  assert.equal((await putProgress(req(A, 'PUT', { kind: 'fitness', revision: 2, value: fitness }), deps(A, failing))).status, 503);
  const response = await getProgress(deps(A));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('backup validation endpoint uses the save rules without saving', async () => {
  const validate = (body) =>
    validateBackup(new Request(`${ORIGIN}/api/progress/validate`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) }), deps(A));
  const ok = await (await validate({ version: 1, fitness, nutrition: null })).json();
  assert.equal(ok.valid, true);
  assert.equal(ok.kinds.fitness.present, true);
  assert.equal(ok.kinds.nutrition.present, false);
  const bad = await (await validate({ version: 1, fitness: { ...fitness, profile: { ...fitness.profile, weight: 5 } } })).json();
  assert.equal(bad.valid, false);
  assert.match(bad.kinds.fitness.errors[0], /profile › weight/);
  assert.equal((await (await validate({ hello: 'world' })).json()).valid, false);
  assert.equal((await (await validate({ version: 1 })).json()).valid, false, 'empty backups are rejected');
  const before = await (await getProgress(deps(A))).json();
  assert.equal(before.records.fitness.revision, 2, 'validation never writes');
});

// ---- Direct database checks: RLS must hold even without the API ----

test('RLS: users cannot read or change each other’s rows directly', async () => {
  const seenByB = await as(B, async (c) => (await c.query('select user_id from public.progress')).rows);
  assert.ok(seenByB.every((r) => r.user_id === B));

  const updated = await as(B, async (c) => (await c.query("update public.progress set payload = '{}'::jsonb where user_id = $1", [A])).rowCount);
  assert.equal(updated, 0);

  await assert.rejects(
    as(B, (c) => c.query("insert into public.progress (user_id, kind, payload, revision) values ($1, 'nutrition', '{}'::jsonb, 1)", [A])),
    /row-level security/,
  );
  // Changing your own row's owner to someone else is also refused.
  await assert.rejects(as(B, (c) => c.query('update public.progress set user_id = $1 where user_id = $2', [A, B])), /row-level security/);
});

test('RLS: nobody can delete records, and anonymous callers get nothing', async () => {
  await assert.rejects(as(A, (c) => c.query('delete from public.progress')), /permission denied/);
  await assert.rejects(as(null, (c) => c.query('select * from public.progress')), /permission denied/);
  await assert.rejects(as(null, (c) => c.query("select public.save_progress('fitness', 0, '{}'::jsonb)")), /permission denied/);
  await assert.rejects(as(A, (c) => c.query('insert into public.progress_history (user_id, kind, payload, revision) values ($1, $2, $3, 1)', [A, 'fitness', '{}'])), /permission denied/);
});

test('history keeps previous versions for recovery, visible only to the owner', async () => {
  const history = await as(A, async (c) => (await c.query("select revision, payload from public.progress_history where kind = 'fitness' order by id")).rows);
  assert.equal(history.length, 1);
  assert.equal(history[0].revision, 1);
  assert.deepEqual(history[0].payload.weights, {});
  const seenByB = await as(B, async (c) => (await c.query('select * from public.progress_history')).rows);
  assert.ok(seenByB.every((r) => r.user_id === B));
});

test('concurrent saves from two tabs: exactly one wins', async () => {
  const value = (kg) => ({ ...fitness, weights: { '2026-11-01': kg } });
  const results = await Promise.all([
    putProgress(req(A, 'PUT', { kind: 'fitness', revision: 2, value: value(85) }), deps(A)),
    putProgress(req(A, 'PUT', { kind: 'fitness', revision: 2, value: value(84) }), deps(A)),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const saved = await (await getProgress(deps(A))).json();
  assert.equal(saved.records.fitness.revision, 3);
});
