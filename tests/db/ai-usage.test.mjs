// The daily photo-analysis allowance, run as the `authenticated` role.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const pool = new pg.Pool();
after(() => pool.end());
const C = '00000000-0000-4000-8000-00000000000c';
const D = '00000000-0000-4000-8000-00000000000d';
await pool.query('insert into auth.users (id, email) values ($1, $2), ($3, $4) on conflict do nothing', [C, 'c@test', D, 'd@test']);

async function as(userId, sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    const result = await client.query(sql, params);
    await client.query('commit');
    return result.rows;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
const take = (user, limit = 3) => as(user, 'select public.use_ai_quota($1) as ok', [limit]).then((r) => r[0].ok);

test('each account gets its own daily allowance', async () => {
  assert.deepEqual([await take(C), await take(C), await take(C), await take(C)], [true, true, true, false]);
  assert.equal(await take(D), true); // another account is unaffected
  const [{ count }] = (await pool.query('select count from public.ai_usage where user_id = $1', [C])).rows;
  assert.equal(count, 3); // refused attempts are not counted
});

test('the usage table is closed to users and anonymous callers', async () => {
  await assert.rejects(as(C, 'select * from public.ai_usage'), /permission denied/);
  await assert.rejects(as(C, 'update public.ai_usage set count = 0'), /permission denied/);
  await assert.rejects(as(null, 'select public.use_ai_quota(5)'), /permission denied/);
});
