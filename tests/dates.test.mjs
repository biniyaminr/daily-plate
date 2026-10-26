import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/plate/dates.js';

const { today, addDays, weekday, daysBetween, isValid } = globalThis.PlateDate;

test('today follows Africa/Addis_Ababa, not the device timezone', () => {
  // 21:30 UTC on 25 Oct is already 00:30 on 26 Oct in Addis Ababa (UTC+3).
  assert.equal(today(new Date('2026-10-25T21:30:00Z')), '2026-10-26');
  // 20:59 UTC is still 23:59 on 25 Oct in Addis Ababa.
  assert.equal(today(new Date('2026-10-25T20:59:00Z')), '2026-10-25');
});

test('today ignores the process timezone', () => {
  const previous = process.env.TZ;
  for (const tz of ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
    process.env.TZ = tz;
    assert.equal(today(new Date('2026-03-08T22:00:00Z')), '2026-03-09', tz);
  }
  process.env.TZ = previous;
});

test('addDays crosses months, years, leap days and DST dates without shifting', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09'); // US DST start
  assert.equal(addDays('2026-03-29', -1), '2026-03-28'); // EU DST start
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('weekday uses the plan order Monday=0 … Sunday=6', () => {
  assert.equal(weekday('2026-10-26'), 0); // Monday
  assert.equal(weekday('2026-10-28'), 2); // Wednesday: active recovery
  assert.equal(weekday('2026-11-01'), 6); // Sunday: full recovery
});

test('daysBetween counts calendar days for the 12-week program', () => {
  assert.equal(daysBetween('2026-10-22', '2026-10-22'), 0);
  assert.equal(daysBetween('2026-10-22', '2027-01-14'), 84);
  assert.equal(daysBetween('2026-10-22', '2026-10-21'), -1);
});

test('isValid rejects impossible dates', () => {
  assert.equal(isValid('2026-02-30'), false);
  assert.equal(isValid('2026-13-01'), false);
  assert.equal(isValid('26-10-01'), false);
  assert.equal(isValid(null), false);
  assert.equal(isValid('2028-02-29'), true);
});
