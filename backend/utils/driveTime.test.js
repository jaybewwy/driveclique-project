// Unit tests for drive start-time resolution. Run with `npm test` in backend/.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  zonedTimeToUtc,
  parseTimeOfDay,
  formatTimeOfDay,
  toCalendarDay,
  addCalendarDays,
  addCalendarMonths,
  resolveDriveSchedule,
  driveStartsAt,
  formatDriveWhen,
  isValidTimeZone,
  DEFAULT_TIME_ZONE,
} = require('./driveTime');

const at = (year, month, day, hour, minute, timeZone) =>
  zonedTimeToUtc({ year, month, day, hour, minute }, timeZone).toISOString();

test('zonedTimeToUtc: fixed-offset and DST zones on ordinary days', () => {
  assert.equal(at(2026, 10, 9, 10, 0, 'America/Phoenix'), '2026-10-09T17:00:00.000Z'); // MST, no DST
  assert.equal(at(2026, 10, 9, 10, 0, 'America/Los_Angeles'), '2026-10-09T17:00:00.000Z'); // PDT
  assert.equal(at(2026, 12, 9, 10, 0, 'America/Los_Angeles'), '2026-12-09T18:00:00.000Z'); // PST
  assert.equal(at(2026, 10, 9, 10, 0, 'Asia/Tokyo'), '2026-10-09T01:00:00.000Z');
  assert.equal(at(2026, 10, 9, 10, 0, 'UTC'), '2026-10-09T10:00:00.000Z');
  assert.equal(at(2026, 10, 9, 10, 0, 'Asia/Kolkata'), '2026-10-09T04:30:00.000Z'); // half-hour offset
  assert.equal(at(2027, 1, 9, 10, 0, 'Pacific/Auckland'), '2027-01-08T21:00:00.000Z'); // NZDT, +13
  assert.equal(at(2026, 10, 9, 0, 0, 'America/Los_Angeles'), '2026-10-09T07:00:00.000Z'); // midnight
});

test('zonedTimeToUtc: a time skipped by spring-forward moves ahead by the gap', () => {
  // US DST starts 2027-03-14 at 2:00 AM; 2:30 AM never happens in Los Angeles
  assert.equal(at(2027, 3, 14, 2, 30, 'America/Los_Angeles'), '2027-03-14T10:30:00.000Z'); // = 3:30 AM PDT
  assert.equal(at(2027, 3, 14, 1, 59, 'America/Los_Angeles'), '2027-03-14T09:59:00.000Z'); // PST, just before
  assert.equal(at(2027, 3, 14, 3, 0, 'America/Los_Angeles'), '2027-03-14T10:00:00.000Z'); // PDT, just after
});

test('zonedTimeToUtc: a time repeated by fall-back resolves to its first occurrence', () => {
  // US DST ends 2026-11-01 at 2:00 AM; 1:30 AM happens twice in Los Angeles
  assert.equal(at(2026, 11, 1, 1, 30, 'America/Los_Angeles'), '2026-11-01T08:30:00.000Z'); // PDT
  // East of UTC too: UK clocks go back 2026-10-25 at 2:00 AM BST
  assert.equal(at(2026, 10, 25, 1, 30, 'Europe/London'), '2026-10-25T00:30:00.000Z'); // BST
});

test('parseTimeOfDay / formatTimeOfDay: 12- and 24-hour input, canonical output', () => {
  assert.deepEqual(parseTimeOfDay('10:00 AM'), { hour: 10, minute: 0 });
  assert.deepEqual(parseTimeOfDay('09:00 AM'), { hour: 9, minute: 0 });
  assert.deepEqual(parseTimeOfDay('12:00 AM'), { hour: 0, minute: 0 });
  assert.deepEqual(parseTimeOfDay('12:30 pm'), { hour: 12, minute: 30 });
  assert.deepEqual(parseTimeOfDay('6:45PM'), { hour: 18, minute: 45 });
  assert.deepEqual(parseTimeOfDay(' 18:30 '), { hour: 18, minute: 30 });
  for (const bad of ['', 'morning', '13:00 PM', '0:30 AM', '24:00', '10:60', '10 AM', null, undefined]) {
    assert.equal(parseTimeOfDay(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
  }
  assert.equal(formatTimeOfDay({ hour: 0, minute: 5 }), '12:05 AM');
  assert.equal(formatTimeOfDay({ hour: 9, minute: 0 }), '9:00 AM');
  assert.equal(formatTimeOfDay({ hour: 12, minute: 0 }), '12:00 PM');
  assert.equal(formatTimeOfDay({ hour: 23, minute: 30 }), '11:30 PM');
});

test('toCalendarDay: bare days are literal, timestamps use their UTC date, junk is rejected', () => {
  assert.deepEqual(toCalendarDay('2026-10-09'), { year: 2026, month: 10, day: 9 });
  assert.deepEqual(toCalendarDay('2026-10-09T23:30:00.000Z'), { year: 2026, month: 10, day: 9 });
  assert.deepEqual(toCalendarDay('2026-10-09T23:30:00-07:00'), { year: 2026, month: 10, day: 10 });
  assert.deepEqual(toCalendarDay(new Date('2026-10-09T00:00:00Z')), { year: 2026, month: 10, day: 9 });
  assert.equal(toCalendarDay('2026-02-30'), null);
  assert.equal(toCalendarDay('not a date'), null);
});

test('calendar-day arithmetic ignores DST and handles month/year rollover', () => {
  assert.deepEqual(addCalendarDays({ year: 2026, month: 10, day: 25 }, 7), { year: 2026, month: 11, day: 1 });
  assert.deepEqual(addCalendarDays({ year: 2026, month: 12, day: 28 }, 14), { year: 2027, month: 1, day: 11 });
  assert.deepEqual(addCalendarMonths({ year: 2026, month: 11, day: 15 }, 2), { year: 2027, month: 1, day: 15 });
});

test('resolveDriveSchedule: normalizes fields and keeps wall time across a DST change', () => {
  const before = resolveDriveSchedule({ date: '2026-10-24', time: '10:00 AM', timeZone: 'America/Los_Angeles' });
  assert.equal(before.startsAt.toISOString(), '2026-10-24T17:00:00.000Z');
  assert.equal(before.date.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.equal(before.time, '10:00 AM');
  const after = resolveDriveSchedule({ date: '2026-11-07', time: '10:00 AM', timeZone: 'America/Los_Angeles' });
  assert.equal(after.startsAt.toISOString(), '2026-11-07T18:00:00.000Z'); // same 10 AM, now PST

  const normalized = resolveDriveSchedule({ date: '2026-10-09T15:12:00Z', time: '09:00 AM' });
  assert.equal(normalized.date.toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(normalized.time, '9:00 AM');
  assert.equal(normalized.timeZone, DEFAULT_TIME_ZONE);
});

test('resolveDriveSchedule rejects bad dates, times, and zones with a 400', () => {
  const cases = [
    { date: 'soon', time: '10:00 AM' },
    { date: '2026-10-09', time: 'morning' },
    { date: '2026-10-09', time: '10:00 AM', timeZone: 'Mars/Olympus_Mons' },
    { date: '2026-10-09', time: '10:00 AM', timeZone: '' },
  ];
  for (const input of cases) {
    assert.throws(() => resolveDriveSchedule(input), (error) => error.statusCode === 400, JSON.stringify(input));
  }
  assert.equal(isValidTimeZone('America/New_York'), true);
  assert.equal(isValidTimeZone(42), false);
});

test('driveStartsAt / formatDriveWhen: new drives use their zone, legacy drives keep old behaviour', () => {
  const drive = resolveDriveSchedule({ date: '2026-10-09', time: '10:00 AM', timeZone: 'America/Phoenix' });
  assert.equal(driveStartsAt(drive).toISOString(), '2026-10-09T17:00:00.000Z');
  assert.equal(formatDriveWhen(drive), 'Friday, October 9, 2026 at 10:00 AM MST');

  const legacy = { date: new Date('2026-10-09T00:00:00Z'), time: '10:00 AM' };
  assert.equal(driveStartsAt(legacy).toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(formatDriveWhen(legacy), 'Friday, October 9, 2026 at 10:00 AM');
});
