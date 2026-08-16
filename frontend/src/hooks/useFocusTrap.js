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

/**
 * Same trap/restore behavior as useFocusTrap, but for components that render
 * many mutually-exclusive overlay panels (e.g. a page with a dozen `{show*Modal
 * && <div role="dialog">...}` blocks) where attaching a separate ref to every
 * one isn't practical. Operates on whichever `[role="dialog"][aria-modal="true"]`
 * is currently in the DOM rather than a fixed ref.
 *
 * Usage: useDocumentFocusTrap(isAnyOverlayOpen) — pass a single boolean that's
 * true whenever *any* of the page's overlays is open.
 */
export const useDocumentFocusTrap = (isOpen) => {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (dialog) {
      const firstFocusable = dialog.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || dialog).focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const currentDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);
};

export default useFocusTrap;
