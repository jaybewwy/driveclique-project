// Unit tests for .ics event timing. Run with `npm test` in backend/.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVEvent } = require('./ics');
const { resolveDriveSchedule } = require('./driveTime');

const base = { _id: 'abc123', name: 'Canyon Run', location: 'Lot A' };

test('a drive with a start instant exports real UTC times', () => {
  const drive = { ...base, ...resolveDriveSchedule({ date: '2026-10-09', time: '10:00 AM', timeZone: 'America/Phoenix' }) };
  const vevent = buildVEvent(drive, 'Desert Club');
  assert.match(vevent, /DTSTART:20261009T170000Z/);
  assert.match(vevent, /DTEND:20261009T180000Z/);
});

// Legacy drives (no startsAt until the migration runs) keep the UC-33 behaviour
test('a legacy drive with a parseable time exports a floating local time', () => {
  const vevent = buildVEvent({ ...base, date: new Date('2026-10-09T00:00:00Z'), time: '2:30 PM' }, 'Desert Club');
  assert.match(vevent, /DTSTART:20261009T143000\r?\n/);
  assert.match(vevent, /DTEND:20261009T153000\r?\n/);
});

test('a legacy drive with an unparseable time falls back to an all-day event', () => {
  const vevent = buildVEvent({ ...base, date: new Date('2026-10-09T00:00:00Z'), time: 'TBD' }, 'Desert Club');
  assert.match(vevent, /DTSTART;VALUE=DATE:20261009/);
  assert.match(vevent, /DURATION:P1D/);
  assert.doesNotMatch(vevent, /DTSTART:\d{8}T/);
});
