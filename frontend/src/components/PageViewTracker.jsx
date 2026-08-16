import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../services/analytics';

/**
 * Fires a PAGE_VIEW analytics event on every route change. Mounted once
 * inside <Router> so every page is covered without per-page wiring.
 */
const PageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Deferred to the next tick so this best-effort ping never competes with
    // the page's own mount-time effects (auth bootstrap, initial data fetches)
    // for the network/microtask queue.
    const timer = setTimeout(() => trackEvent('PAGE_VIEW', { path: location.pathname }), 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
};

export default PageViewTracker;
