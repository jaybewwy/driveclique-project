import { useState, useCallback } from 'react';
import { drivesAPI } from '../services/api';
import { trackEvent } from '../services/analytics';

/**
 * Submits an RSVP for a drive, then always runs a caller-supplied
 * reconciliation step before resolving — rsvpToDrive's capacity path can
 * silently substitute 'waitlisted' for a requested 'going', so the status
 * the user asked for must never be trusted as final (Invariant #5,
 * 00-audit.md). Both ClubDetail.jsx and Calendar.jsx independently
 * implemented this exact submit-then-reconcile sequence before; this hook
 * is the one shared place it lives now.
 *
 * `reconcile` is caller-supplied rather than this hook hardcoding its own
 * getRSVPStatus call, because each page needs a different amount of data
 * back afterward: ClubDetail.jsx's existing fetchDriveRSVPData() also
 * refreshes check-in counts and the page-wide driveRSVPCounts map (state
 * this hook has no business owning), while Calendar.jsx only needs to
 * update one drive's status in its own list. Hardcoding a second fetch
 * here would mean ClubDetail.jsx making two network round trips (this
 * hook's own, then its existing broader refresh) for what was previously
 * one.
 *
 * Errors are intentionally left to the caller's own try/catch — the two
 * existing call sites display failures differently (an inline message that
 * clears itself vs. a page-level error banner plus a full month re-fetch),
 * so this hook only owns the submit + track + reconcile sequencing, not
 * error presentation.
 */
export const useDriveRsvp = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRsvp = useCallback(async (driveId, status, reconcile) => {
    setIsSubmitting(true);
    try {
      const response = await drivesAPI.rsvp(driveId, status);
      trackEvent('RSVP_SUBMITTED', { driveId, status });
      await reconcile();
      return response.data;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, submitRsvp };
};
