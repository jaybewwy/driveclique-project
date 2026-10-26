import { useMemo } from 'react';

/**
 * RSVP counts for each drive in `drives`: { [driveId]: { going, maybe,
 * notGoing } }, or { failed: true } for a drive whose counts are missing, so
 * a card can say so instead of showing a fake "0 going".
 *
 * The counts arrive with the club's drive list (`rsvpCounts` on each drive),
 * so this asks the server for nothing. It used to request each upcoming
 * drive's RSVP status, one request per drive. Fresher counts from the drive
 * modal belong on the drive in the list, which keeps one source for them.
 *
 * `canViewRsvps` is whether the viewer is a member of the club. RSVP data is
 * members-only, so a visitor's list carries no counts and gets none here.
 */
export const useDriveRsvpCounts = (drives, canViewRsvps) => useMemo(() => {
  const countsByDrive = {};
  if (!canViewRsvps) return countsByDrive;
  drives.forEach(({ _id, rsvpCounts }) => {
    countsByDrive[_id] = rsvpCounts
      ? { going: rsvpCounts.going, maybe: rsvpCounts.maybe, notGoing: rsvpCounts.notGoing, failed: false }
      : { failed: true };
  });
  return countsByDrive;
}, [drives, canViewRsvps]);
