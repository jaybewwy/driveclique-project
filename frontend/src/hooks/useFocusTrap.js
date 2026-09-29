import { useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus within an open dialog and restores focus to the
 * previously-focused element (the trigger button) when it closes.
 *
 * Usage: const dialogRef = useFocusTrap(isOpen); <div ref={dialogRef}>...</div>
 */
const useFocusTrap = (isOpen) => {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (container) {
      const firstFocusable = container.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || container).focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
};

// The topmost open modal dialog: the last one in the DOM, since overlays
// stacked on another (a confirmation over a list modal) render after it
const topDialog = () => {
  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return dialogs[dialogs.length - 1] || null;
};

/**
 * Same trap/restore behavior as useFocusTrap, but for components that render
 * many overlay panels themselves (e.g. a page with a dozen `{show*Modal &&
 * <div role="dialog">...}` blocks) where attaching a separate ref to every
 * one isn't practical. Works on whichever `[role="dialog"][aria-modal="true"]`
 * is on top rather than a fixed ref, and handles overlays stacked on one
 * another: each newly opened one gets focus, and closing it returns focus to
 * whatever opened it.
 *
 * Usage: useDocumentFocusTrap(openOverlayCount) — how many of the page's
 * overlays are currently open.
 */
export const useDocumentFocusTrap = (openCount) => {
  const isOpen = openCount > 0;
  const returnFocusStack = useRef([]);
  const previousCount = useRef(0);

  // Focus into each overlay as it opens; hand focus back as each one closes
  useEffect(() => {
    const before = previousCount.current;
    previousCount.current = openCount;

    if (openCount > before) {
      returnFocusStack.current.push(document.activeElement);
      const dialog = topDialog();
      if (dialog) (dialog.querySelector(FOCUSABLE_SELECTOR) || dialog).focus();
    } else if (openCount < before) {
      let returnTo = null;
      for (let i = openCount; i < before; i++) returnTo = returnFocusStack.current.pop() ?? returnTo;
      if (returnTo?.isConnected) returnTo.focus();
    }
  }, [openCount]);

  // Keep Tab / Shift+Tab inside the top overlay
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const currentDialog = topDialog();
      if (!currentDialog) return;

      const focusable = Array.from(
        currentDialog.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
};

export default useFocusTrap;
