/**
 * Extract the calendar day-of-month, month (1-indexed), and year from a
 * drive/event Date the same way the backend buckets it — in UTC, not the
 * viewer's local timezone. Drive dates are stored as UTC-midnight (see
 * backend/controllers/driveController.js's getCalendarDrives), so reading
 * them back with local Date methods can shift the displayed day by up to a
 * full day (or roll into an adjacent month) depending on the viewer's UTC
 * offset.
 *
 * Do not use this for values that are genuinely meant to display in the
 * viewer's local time (e.g. a "posted 2 hours ago" relative timestamp) —
 * only for bucketing a drive's stored date into a day/month/year cell.
 */
export const getUTCDateParts = (dateInput) => {
  const d = new Date(dateInput);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

// ─── Drive start times ───────────────────────────────────────────────────────
//
// A drive has `date` (its local calendar day, stored as UTC midnight),
// `time` ("H:MM AM/PM" wall clock), and, since time zones were added,
// `startsAt` (the exact start instant) plus `timeZone` (the IANA zone the
// drive happens in). See backend/utils/driveTime.js. Drives created earlier
// lack the last two until the backend migration runs; every helper below
// falls back to the old behaviour for them.
//
// Pages should use these helpers rather than formatting drive.date/time
// directly, so a drive shows the same day and time everywhere.

export const getViewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const hasZonedStart = (drive) => Boolean(drive?.startsAt && drive?.timeZone);

// When the drive starts, as a Date (legacy drives: their calendar-day date)
export const getDriveStart = (drive) => new Date(drive.startsAt || drive.date);

export const hasDriveStarted = (drive, now = new Date()) => getDriveStart(drive) < now;

// Sort comparator, soonest first
export const compareDriveStart = (a, b) => getDriveStart(a) - getDriveStart(b);

/**
 * The drive's calendar day, e.g. "Oct 9, 2026". Read in UTC because `date`
 * is UTC midnight of the drive's own local day, so every viewer sees the
 * day the drive actually happens, whatever zone they're in.
 */
export const formatDriveDate = (drive, options = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(drive.date).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

// The drive's start in its own zone, e.g. "10:00 AM MST"; legacy drives show their saved text
export const formatDriveTime = (drive) => {
  if (!hasZonedStart(drive)) return drive?.time || "";
  return new Date(drive.startsAt).toLocaleTimeString("en-US", {
    timeZone: drive.timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
};

/**
 * The same start on the viewer's clock, e.g. "1:00 PM your time", or with
 * the day when it lands on a different one ("Sat, Oct 10, 2:00 AM your
 * time"). Null when the viewer's clock reads the same as the drive's, or
 * for legacy drives with no zone to convert from.
 */
export const formatDriveViewerTime = (drive, viewerTimeZone = getViewerTimeZone()) => {
  if (!hasZonedStart(drive)) return null;
  const start = new Date(drive.startsAt);
  const clock = (timeZone) => start.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const day = (timeZone) => start.toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const sameDay = day(drive.timeZone) === day(viewerTimeZone);
  if (sameDay && clock(drive.timeZone) === clock(viewerTimeZone)) return null;
  return `${sameDay ? "" : `${day(viewerTimeZone)}, `}${clock(viewerTimeZone)} your time`;
};

// "10:00 AM MST (1:00 PM your time)", for the one-line time slots on drive cards
export const formatDriveTimeLabel = (drive) => {
  const time = formatDriveTime(drive);
  const viewerTime = formatDriveViewerTime(drive);
  return viewerTime ? `${time} (${viewerTime})` : time;
};
