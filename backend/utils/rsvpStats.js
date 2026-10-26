const RSVP = require('../models/rsvp');

/**
 * Tally RSVPs by status in one pass. `rsvps` only needs a `status` field.
 */
const countRsvpStatuses = (rsvps) => rsvps.reduce(
  (acc, r) => {
    if (r.status === 'going') acc.going++;
    else if (r.status === 'maybe') acc.maybe++;
    else if (r.status === 'not-going') acc.notGoing++;
    else if (r.status === 'waitlisted') acc.waitlisted++;
    return acc;
  },
  { going: 0, maybe: 0, notGoing: 0, waitlisted: 0 }
);

// RSVP statuses as countRsvpStatuses() names them
const RSVP_COUNT_KEYS = { going: 'going', maybe: 'maybe', 'not-going': 'notGoing', waitlisted: 'waitlisted' };

/**
 * Each drive's RSVP counts, keyed by drive id, counted by MongoDB in one
 * aggregation: a few rows per drive reach the API, not every RSVP.
 */
const countRsvpsByDrive = async (driveIds) => {
  const groups = await RSVP.aggregate([
    { $match: { drive: { $in: driveIds } } },
    { $group: { _id: { drive: '$drive', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const counts = new Map(driveIds.map((id) => [id.toString(), countRsvpStatuses([])]));
  groups.forEach(({ _id, count }) => {
    const tally = counts.get(_id.drive.toString());
    const key = RSVP_COUNT_KEYS[_id.status];
    if (tally && key) tally[key] += count;
  });
  return counts;
};

module.exports = { countRsvpStatuses, countRsvpsByDrive };
