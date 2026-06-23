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
    trackEvent('PAGE_VIEW', { path: location.pathname });
  }, [location.pathname]);

  return null;
};

export default PageViewTracker;
