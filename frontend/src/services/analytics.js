import { eventsAPI } from './api';

/**
 * Fire-and-forget product-analytics event. Never throws and never blocks
 * the caller — a failed analytics call must not break the user-facing
 * action it's attached to (same convention as the backend's fire-and-forget
 * emails).
 */
export const trackEvent = (type, metadata = {}) => {
  try {
    eventsAPI.track({ type, path: window.location.pathname, metadata }).catch(() => {});
  } catch {
    // analytics must never throw
  }
};

export const getMyActivitySummary = () => eventsAPI.getMySummary();
export const getAdminAnalyticsSummary = () => eventsAPI.getAdminSummary();
