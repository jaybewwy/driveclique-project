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
