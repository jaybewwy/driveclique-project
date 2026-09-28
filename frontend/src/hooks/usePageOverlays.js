import { useEffect } from 'react';
import { useDocumentFocusTrap } from './useFocusTrap';

/**
 * For a page that renders many of its own overlays (e.g. ClubDetail's
 * modals and confirmation dialogs): traps focus in whichever one is open
 * and, on Escape, closes the first open one in the given order.
 *
 * @param {Array<[boolean, () => void]>} overlays - [isOpen, close] pairs,
 *   highest Escape priority first
 */
export const usePageOverlays = (overlays) => {
  const anyOpen = overlays.some(([isOpen]) => isOpen);
  useDocumentFocusTrap(anyOpen);

  // Re-registered every render so the handler always sees current state
  useEffect(() => {
    if (!anyOpen) return;
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      const top = overlays.find(([isOpen]) => isOpen);
      if (top) top[1]();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  });
};
