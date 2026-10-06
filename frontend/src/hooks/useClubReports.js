import { useEffect, useState } from 'react';
import { reportsAPI } from '../services/api';

const REVIEW_OUTCOMES = {
  resolved: 'Report resolved.',
  dismissed: 'Report dismissed.',
  open: 'Report reopened.',
};

/**
 * A club's report review queue (UC-42), one page of one tab at a time.
 * `tab` is 'open' or 'closed'.
 *
 * review(report, status) closes a report ('resolved' / 'dismissed') or
 * reopens it ('open'). Either way it moves to the other tab, so the page
 * being shown is reloaded afterwards; `busyId` is that report's id until the
 * reload lands. `message` is the { type, text } outcome to show.
 */
export const useClubReports = (clubId) => {
  const [tab, setTab] = useState('open');
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  // The last page to arrive, tagged with the tab and page it belongs to
  const [loaded, setLoaded] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let ignore = false;
    reportsAPI.getClubReports(clubId, tab, page)
      .then((response) => {
        if (ignore) return;
        const { reports, openCount, pagination } = response.data;
        // The last report on a later page was just handled: step back one
        if (reports.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setLoaded({ tab, page, reports, openCount, pagination });
        setLoadFailed(false);
        setBusyId(null);
      })
      .catch(() => {
        if (ignore) return;
        setLoadFailed(true);
        setBusyId(null);
      });
    return () => { ignore = true; };
  }, [clubId, tab, page, reloads]);

  const showTab = (nextTab) => {
    setTab(nextTab);
    setPage(1);
    setMessage(null);
  };

  const retry = () => {
    setLoadFailed(false);
    setReloads((n) => n + 1);
  };

  const review = async (report, status) => {
    setBusyId(report._id);
    setMessage(null);
    try {
      await reportsAPI.review(report._id, status);
      setMessage({ type: 'success', text: REVIEW_OUTCOMES[status] });
      setReloads((n) => n + 1);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not update the report. Please try again.' });
      setBusyId(null);
    }
  };

  const isCurrent = loaded?.tab === tab && loaded?.page === page;

  return {
    tab,
    showTab,
    page,
    setPage,
    loading: !loadFailed && !isCurrent,
    loadFailed,
    retry,
    reports: isCurrent ? loaded.reports : [],
    pagination: isCurrent ? loaded.pagination : null,
    // Kept across tab switches, so the Open tab's count doesn't blink
    openCount: loaded?.openCount ?? 0,
    busyId,
    message,
    review,
  };
};
