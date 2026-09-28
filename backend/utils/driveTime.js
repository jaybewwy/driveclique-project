/**
 * Drive start times with real time zones.
 *
 * A drive has two views of when it happens:
 * - `date` is the drive's local calendar day, stored as UTC midnight of that
 *   day. Calendar bucketing, the mobile app, and legacy readers rely on this.
 * - `startsAt` is the exact instant it starts, computed from `date`, the
 *   wall-clock `time`, and the IANA `timeZone` the drive takes place in.
 *   Everything instant-based (upcoming filters, reminders, .ics export, the
 *   "must be in the future" check) uses this.
 *
 * Drives created before time zones were stored have no `startsAt` until
 * backend/scripts/migrate-drive-start-times.js runs. `driveStartsAt()` and
 * `upcomingDriveFilter()` fall back to their old behaviour (treating `date`
 * as the instant) so nothing disappears in the meantime.
 *
 * No date library: Intl (full ICU ships with Node) resolves zone offsets.
 */
const { AppError } = require('../middleware/errorHandler');

const DEFAULT_TIME_ZONE = process.env.DEFAULT_TIME_ZONE || 'America/Los_Angeles';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// One formatter per zone; constructing Intl.DateTimeFormat is comparatively slow
const offsetFormatters = new Map();
function offsetFormatter(timeZone) {
  if (!offsetFormatters.has(timeZone)) {
    offsetFormatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }));
  }
  return offsetFormatters.get(timeZone);
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    offsetFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

// Minutes the zone is ahead of UTC at a given instant (e.g. -420 for PDT)
function offsetMinutesAt(instantMs, timeZone) {
  const parts = {};
  for (const { type, value } of offsetFormatter(timeZone).formatToParts(new Date(instantMs))) {
    parts[type] = Number(value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / MINUTE_MS);
}

/**
 * The instant at which a zone's wall clock reads the given local time.
 * Offsets are sampled a day either side, which brackets any single DST
 * transition, and each candidate is kept only if it round-trips. That
 * resolves both DST edge cases the same way JavaScript's Temporal API does
 * by default: a time skipped by spring-forward moves ahead by the gap
 * (2:30 AM becomes 3:30 AM), and a time repeated by fall-back picks the
 * first occurrence.
 */
function zonedTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  const wallMs = Date.UTC(year, month - 1, day, hour, minute);
  const offsetBefore = offsetMinutesAt(wallMs - DAY_MS, timeZone);
  const offsetAfter = offsetMinutesAt(wallMs + DAY_MS, timeZone);
  const candidates = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => wallMs - offset * MINUTE_MS)
    .filter((instant) => wallMs - offsetMinutesAt(instant, timeZone) * MINUTE_MS === instant);
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  return new Date(wallMs - offsetBefore * MINUTE_MS);
}

// "10:00 AM", "10:00AM", "9:30 pm", or 24-hour "18:30"
const TIME_12H = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
const TIME_24H = /^(\d{1,2}):(\d{2})$/;

function parseTimeOfDay(value) {
  const text = String(value ?? '').trim();
  let match = TIME_12H.exec(text);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (hour === 12) hour = 0;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    return { hour, minute };
  }
  match = TIME_24H.exec(text);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  return null;
}

// Canonical "H:MM AM/PM", the same format as the scheduler's time slots
function formatTimeOfDay({ hour, minute }) {
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/**
 * The calendar day a request's `date` names. A bare "YYYY-MM-DD" (what the
 * web app sends) is taken literally. A full timestamp (what API clients and
 * the test suite send) is read by its UTC date, the same rule legacy drives
 * always followed, so old and new data agree about which day a drive is on.
 */
function toCalendarDay(value) {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match) {
      const [year, month, day] = match.slice(1).map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
      return { year, month, day };
    }
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
}

const calendarDayToDate = ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day));

// Day arithmetic on calendar days, independent of any zone's DST
function addCalendarDays(calendarDay, days) {
  return toCalendarDay(new Date(calendarDayToDate(calendarDay).getTime() + days * DAY_MS));
}

function addCalendarMonths({ year, month, day }, months) {
  // Date.UTC normalizes month overflow; day overflow (Jan 31 + 1 month)
  // rolls into the next month, the same as the recurrence code always did
  return toCalendarDay(new Date(Date.UTC(year, month - 1 + months, day)));
}

/**
 * Validate and resolve a drive's schedule into the fields stored on it.
 * @returns {{ date: Date, time: string, timeZone: string, startsAt: Date }}
 * @throws {AppError} 400 for an unparseable date or time or an unknown zone
 */
function resolveDriveSchedule({ date, time, timeZone }) {
  const calendarDay = toCalendarDay(date);
  if (!calendarDay) throw new AppError('Invalid drive date', 400);
  const timeOfDay = parseTimeOfDay(time);
  if (!timeOfDay) throw new AppError('Invalid drive time. Use a format like "10:00 AM"', 400);
  const zone = timeZone ?? DEFAULT_TIME_ZONE;
  if (!isValidTimeZone(zone)) throw new AppError('Invalid time zone', 400);
  return {
    date: calendarDayToDate(calendarDay),
    time: formatTimeOfDay(timeOfDay),
    timeZone: zone,
    startsAt: zonedTimeToUtc({ ...calendarDay, ...timeOfDay }, zone),
  };
}

// When a drive starts; unmigrated drives fall back to their calendar-day `date`
const driveStartsAt = (drive) => new Date(drive.startsAt || drive.date);

/**
 * Mongo filter for drives whose start falls in `range` (e.g. { $gte, $lte }).
 * Unmigrated drives keep their pre-time-zone rule (`date` compared as an
 * instant) until the migration fills in `startsAt`. Uses `$or`, so spread
 * it only into a filter that has no `$or` of its own.
 */
const driveStartsInFilter = (range) => ({
  $or: [
    { startsAt: range },
    { startsAt: null, date: range },
  ],
});

// Drives that haven't started yet
const upcomingDriveFilter = (now = new Date()) => driveStartsInFilter({ $gte: now });

/**
 * "Friday, October 9, 2026 at 10:00 AM PDT", in the drive's own zone, for
 * emails. Unmigrated drives keep their old rendering: the UTC calendar day
 * plus whatever time text was saved.
 */
function formatDriveWhen(drive) {
  if (drive.startsAt && drive.timeZone) {
    const start = new Date(drive.startsAt);
    const day = start.toLocaleDateString('en-US', {
      timeZone: drive.timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const clock = start.toLocaleTimeString('en-US', {
      timeZone: drive.timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
    return `${day} at ${clock}`;
  }
  const day = new Date(drive.date).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  return drive.time ? `${day} at ${drive.time}` : day;
}

module.exports = {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  zonedTimeToUtc,
  parseTimeOfDay,
  formatTimeOfDay,
  toCalendarDay,
  calendarDayToDate,
  addCalendarDays,
  addCalendarMonths,
  resolveDriveSchedule,
  driveStartsAt,
  driveStartsInFilter,
  upcomingDriveFilter,
  formatDriveWhen,
};
