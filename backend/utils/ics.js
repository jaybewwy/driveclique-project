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

// Drives with a stored start instant (`startsAt`, see utils/driveTime.js)
// export as real UTC times (`Z` suffix), which calendar apps convert to each
// viewer's own zone. Legacy drives from before time zones were stored have
// only a calendar day plus zone-less time text; for those a floating time
// (no `Z`, no TZID) is still the only honest representation, and RFC 5545
// floating times are read in the viewer's local zone.
const { parseTimeOfDay } = require('./driveTime');

const pad2 = (n) => String(n).padStart(2, '0');

// Drive.date is stored as UTC midnight of the drive's calendar day, so the
// day/month/year must be read with the UTC getters — local getters would
// shift the day depending on the server's own timezone.
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

// UTC timestamp (`Z` suffix) for real instants: DTSTAMP (when the file was
// generated) and a drive's stored start/end.
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

  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${formatICSUtcStamp(now)}`];
  const parsedTime = parseTimeOfDay(drive.time);

  // No stored duration anywhere in this app — timed events default to 1
  // hour, a placeholder that at least blocks out the right start time
  if (drive.startsAt) {
    const start = new Date(drive.startsAt);
    lines.push(
      `DTSTART:${formatICSUtcStamp(start)}`,
      `DTEND:${formatICSUtcStamp(new Date(start.getTime() + 60 * 60 * 1000))}`
    );
  } else if (parsedTime) {
    // Legacy drive: floating local time on its calendar day
    const start = formatICSDateTime(drive.date, parsedTime.hour, parsedTime.minute);
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
