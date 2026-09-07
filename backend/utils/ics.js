/**
 * Minimal RFC 5545 (iCalendar) generation for UC-33 — no third-party `ics`
 * package (this project's own established preference for plain text
 * generation over a dependency, matching emailService.js's hand-rolled
 * templates). Only the handful of fields DriveClique actually needs.
 */

// Escape backslash, semicolon, comma, and newlines per RFC 5545 §3.3.11.
// Order matters — backslash must be escaped first, or the escaping
// characters just-inserted for ;/,/\n would themselves get re-escaped.
const escapeICSText = (str) =>
  String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');

// RFC 5545 §3.1 caps a content line at 75 octets; longer lines fold onto a
// continuation line starting with a single space. Description/location text
// (user-authored, can run long) is the field most likely to need this.
const foldLine = (line) => {
  const bytes = Buffer.byteLength(line, 'utf8');
  if (bytes <= 75) return line;
  let result = '';
  let chunk = '';
  for (const char of line) {
    const nextChunk = chunk + char;
    if (Buffer.byteLength(nextChunk, 'utf8') > 74) {
      result += (result ? '\r\n ' : '') + chunk;
      chunk = char;
    } else {
      chunk = nextChunk;
    }
  }
  result += (result ? '\r\n ' : '') + chunk;
  return result;
};

// This app stores no timezone anywhere (Drive.date is the UTC-midnight of
// the calendar day the leader picked in their own browser; Drive.time is a
// free-text "H:MM AM/PM" string with no timezone attached at all) — so a
// UTC (`Z`-suffixed) DTSTART would silently misrepresent the intended local
// time. Emitting a floating time (no `Z`, no TZID) is the only honest
// representation of what this data actually means; RFC 5545 floating times
// are interpreted by calendar apps in the viewer's own local timezone.
const TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

const parseTimeString = (timeStr) => {
  const match = TIME_PATTERN.exec(String(timeStr || '').trim());
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const isPM = match[3].toUpperCase() === 'PM';
  if (hour === 12) hour = 0;
  if (isPM) hour += 12;
  return { hour, minute };
};

const pad2 = (n) => String(n).padStart(2, '0');

// Drive.date is stored as UTC midnight of the picked calendar day (the
// frontend sends a bare "YYYY-MM-DD"), so the day/month/year must be read
// with the UTC getters — local getters would shift the day depending on
// the server's own timezone, matching the same UTC-consistency concern
// frontend/src/lib/dateUtils.js's getUTCDateParts() already addresses
// client-side.
const dateParts = (date) => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

const formatICSDateOnly = (date) => {
  const { year, month, day } = dateParts(date);
  return `${year}${pad2(month)}${pad2(day)}`;
};

const formatICSDateTime = (date, hour, minute) => {
  const { year, month, day } = dateParts(date);
  return `${year}${pad2(month)}${pad2(day)}T${pad2(hour)}${pad2(minute)}00`;
};

// UTC timestamp for DTSTAMP/UID — this one legitimately is a real instant
// (when the file was generated), so it correctly gets a `Z` suffix.
const formatICSUtcStamp = (date) => {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
};

/**
 * Build one VEVENT block for a drive.
 * @param {Object} drive - lean Drive doc with club populated to at least { name }
 * @param {string} clubName
 * @returns {string} VEVENT block, no trailing newline
 */
const buildVEvent = (drive, clubName) => {
  const now = new Date();
  const uid = `drive-${drive._id}@driveclique.app`;
  const summary = escapeICSText(`${drive.name} — ${clubName}`);
  const location = escapeICSText(drive.location || '');
  const description = escapeICSText(drive.description || '');

  const parsedTime = parseTimeString(drive.time);
  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${formatICSUtcStamp(now)}`];

  if (parsedTime) {
    const start = formatICSDateTime(drive.date, parsedTime.hour, parsedTime.minute);
    // No stored duration anywhere in this app — default to 1 hour, a
    // reasonable placeholder that at least shows correctly on the day/time
    // the drive starts rather than blocking out no time at all.
    const endHour = (parsedTime.hour + 1) % 24;
    const end = formatICSDateTime(drive.date, endHour, parsedTime.minute);
    lines.push(`DTSTART:${start}`, `DTEND:${end}`);
  } else {
    // Alternate flow: no parseable time — all-day event.
    lines.push(`DTSTART;VALUE=DATE:${formatICSDateOnly(drive.date)}`, 'DURATION:P1D');
  }

  lines.push(`SUMMARY:${summary}`);
  if (location) lines.push(`LOCATION:${location}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push('END:VEVENT');

  return lines.map(foldLine).join('\r\n');
};

/**
 * Wrap one or more VEVENT blocks in a VCALENDAR document.
 * @param {string[]} veventBlocks
 * @returns {string} Full .ics file content (CRLF line endings per spec)
 */
const buildVCalendar = (veventBlocks) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DriveClique//Drive Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...veventBlocks,
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
};

module.exports = { buildVEvent, buildVCalendar, escapeICSText };
