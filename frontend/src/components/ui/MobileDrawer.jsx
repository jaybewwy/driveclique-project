import { useEffect } from "react";
import { Menu, X } from "lucide-react";

/**
 * Floating toggle button for opening a MobileDrawer. Render alongside the
 * breakpoint-hidden desktop sidebar it complements; `breakpointClass` should
 * match that sidebar's `hidden <bp>:flex` so the button only shows when the
 * sidebar itself is hidden.
 */
export function MobileDrawerButton({ onClick, breakpointClass, side = "left", label = "Menu" }) {
  const positionClass = side === "left" ? "left-4" : "right-4";
  return (
    <button
      onClick={onClick}
      aria-label={`Open ${label}`}
      style={{ bottom: `max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))` }}
      className={`${breakpointClass} fixed ${positionClass} z-40 flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 text-white shadow-lg shadow-black/40 hover:border-red-500/50 transition-all duration-300`}
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

/**
 * Slide-in drawer used to surface content that's normally a `hidden <bp>:flex`
 * sidebar once the viewport drops below that breakpoint. Stays mounted at all
 * times so the slide transition can animate; uses `pointer-events-none` while
 * closed so it never blocks clicks on the page behind it.
 */
export function MobileDrawer({ isOpen, onClose, side = "left", children }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const panelSideClass = side === "left" ? "left-0 border-r" : "right-0 border-l";
  const translateClass = isOpen
    ? "translate-x-0"
    : side === "left"
      ? "-translate-x-full"
      : "translate-x-full";

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}>
      <div
        role="presentation"
        aria-hidden="true"
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute top-0 ${panelSideClass} w-72 max-w-[85vw] h-full bg-zinc-950 border-zinc-800/50 overflow-y-auto transition-transform duration-300 ${translateClass}`}
      >
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col h-full p-3 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
