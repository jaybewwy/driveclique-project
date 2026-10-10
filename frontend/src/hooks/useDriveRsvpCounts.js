import { useCallback, useEffect, useState } from 'react';
import { drivesAPI } from '../services/api';
import { hasDriveStarted } from '../lib/dateUtils';

/**
 * RSVP counts for each upcoming drive in `drives`, fetched in parallel
 * whenever the list changes: { [driveId]: { going, maybe, notGoing } }, or
 * { failed: true } for a drive whose count couldn't be loaded — so a card can
 * say so instead of showing a fake "0 going".
 *
 * setCounts(driveId, counts) records fresher counts from elsewhere (e.g.
 * the drive detail modal) so the cards stay current.
 *
 * `canViewRsvps` is whether the viewer is a member of the club. RSVP data is
 * members-only on the server, so for a visitor nothing is requested: every
 * call would come back 403 and be logged as a denied-access event.
 */
export const useDriveRsvpCounts = (drives, canViewRsvps) => {
  const [countsByDrive, setCountsByDrive] = useState({});

  useEffect(() => {
    if (!canViewRsvps) return;
    const upcomingIds = drives
      .filter((d) => !d.isCancelled && !d.isCompleted && !hasDriveStarted(d))
      .map((d) => d._id);
    if (upcomingIds.length === 0) return;

    Promise.all(
      upcomingIds.map((driveId) =>
        drivesAPI.getRSVPStatus(driveId)
          .then((res) => (res.data?.success
            ? { driveId, counts: res.data.counts, failed: false }
            : { driveId, counts: null, failed: true }))
          .catch((error) => {
            console.error(`Failed to load RSVP counts for drive ${driveId}:`, error);
            return { driveId, counts: null, failed: true };
          })
      )
    ).then((results) => {
      const update = {};
      results.forEach((r) => {
        update[r.driveId] = r.failed
          ? { failed: true }
          : { going: r.counts.going, maybe: r.counts.maybe, notGoing: r.counts.notGoing, failed: false };
      });
      setCountsByDrive((prev) => ({ ...prev, ...update }));
    });
  }, [drives, canViewRsvps]);

  const setCounts = useCallback((driveId, counts) => {
    setCountsByDrive((prev) => ({ ...prev, [driveId]: counts }));
  }, []);

  return [countsByDrive, setCounts];
};
