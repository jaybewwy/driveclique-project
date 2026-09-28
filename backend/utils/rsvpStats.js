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

module.exports = { countRsvpStatuses };
