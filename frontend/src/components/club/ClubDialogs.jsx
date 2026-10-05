import { X } from "lucide-react";

// The club pages' overlays don't manage their own focus or Escape key:
// whoever renders them (ClubDetail, Club Settings' Danger Zone) calls
// usePageOverlays, which traps focus in the top [role="dialog"] and routes
// Escape to it.

/** Full-size dialog: large title, an icon-only close button, then children */
export const ClubDialog = ({ titleId, title, closeLabel, onClose, panelClassName, titleClassName = "", children }) => (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={`bg-zinc-900 rounded-3xl p-8 w-full border shadow-2xl ${panelClassName}`}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 id={titleId} className={`text-2xl font-bold ${titleClassName}`}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="text-zinc-400 hover:text-white transition"
        >
          <X size={24} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/** A ClubDialog holding a scrollable list, with a Close button underneath */
export const ClubListDialog = ({ titleId, title, closeLabel, onClose, header, children }) => (
  <ClubDialog
    titleId={titleId}
    title={title}
    closeLabel={closeLabel}
    onClose={onClose}
    panelClassName="max-w-lg border-zinc-800 max-h-[80vh] overflow-hidden flex flex-col"
  >
    {header}
    <div className="space-y-3 overflow-y-auto flex-1 pr-2">{children}</div>
    <div className="pt-4 mt-4 border-t border-zinc-800">
      <button
        type="button"
        onClick={onClose}
        className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
      >
        Close
      </button>
    </div>
  </ClubDialog>
);

/** Small confirmation dialog: a title, then the caller's body and buttons */
export const CompactDialog = ({ titleId, title, children }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-2xl"
    >
      <h3 id={titleId} className="text-lg font-bold mb-2">{title}</h3>
      {children}
    </div>
  </div>
);

/** The Cancel/confirm button pair at the bottom of a CompactDialog */
export const CompactDialogActions = ({ cancelLabel = "Cancel", onCancel, confirmLabel, onConfirm, className = "" }) => (
  <div className={`flex gap-3 ${className}`}>
    <button
      type="button"
      onClick={onCancel}
      className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition"
    >
      {cancelLabel}
    </button>
    <button
      type="button"
      onClick={onConfirm}
      className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition"
    >
      {confirmLabel}
    </button>
  </div>
);
