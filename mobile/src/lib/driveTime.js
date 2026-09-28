// Drive start times, matching the web app's frontend/src/lib/dateUtils.js.
//
// A drive has `date` (its local calendar day, stored as UTC midnight),
// `time` (wall-clock text), and `startsAt` + `timeZone` (exact start instant
// and the IANA zone it happens in). Drives created before time zones were
// stored lack the last two until the backend migration runs, so every
// helper falls back to the old behaviour for them.

const hasZonedStart = (drive) => Boolean(drive?.startsAt && drive?.timeZone);

// When the drive starts, as a Date (legacy drives: their calendar-day date)
export const getDriveStart = (drive) => new Date(drive.startsAt || drive.date);

export const hasDriveStarted = (drive, now = new Date()) => getDriveStart(drive) < now;

export const compareDriveStart = (a, b) => getDriveStart(a) - getDriveStart(b);

// The drive's calendar day, read in UTC so every viewer sees the day it happens
export const formatDriveDate = (drive, options) =>
  new Date(drive.date).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });

/**
 * "10:00 AM MST (1:00 PM your time)". The "your time" part only appears when
 * the device's clock reads differently. Falls back to the saved time text
 * for legacy drives, or if the JS engine's Intl can't resolve the zone.
 */
export const formatDriveTimeLabel = (drive) => {
  if (!hasZonedStart(drive)) return drive?.time || "";
  try {
    const start = new Date(drive.startsAt);
    const clock = (timeZone) => start.toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
    const day = (timeZone) => start.toLocaleDateString(undefined, { timeZone, weekday: "short", month: "short", day: "numeric" });
    const driveTime = start.toLocaleTimeString(undefined, {
      timeZone: drive.timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
    const sameDay = day(drive.timeZone) === day(undefined);
    if (sameDay && clock(drive.timeZone) === clock(undefined)) return driveTime;
    return `${driveTime} (${sameDay ? "" : `${day(undefined)}, `}${clock(undefined)} your time)`;
  } catch {
    return drive.time || "";
  }
};
