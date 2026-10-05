// Layout shared by the Club Settings sections

/** One settings section: its heading, a one-line description, then its controls */
export const SettingsPanel = ({ title, description, children }) => (
  <section>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="text-sm text-zinc-400 mt-1 mb-6">{description}</p>
    {children}
  </section>
);

/**
 * "Save Changes" with the outcome of the last save beside it.
 * `message` is useClubUpdate's { type: 'success' | 'error', text } or null.
 */
export const SaveBar = ({ onSave, saving, disabled, message }) => (
  <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
    <button
      type="button"
      onClick={onSave}
      disabled={saving || disabled}
      className="bg-red-600 hover:bg-red-700 px-6 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {saving ? "Saving…" : "Save Changes"}
    </button>
    {/* Always mounted, so screen readers announce the text when it arrives */}
    <p role="status" className={`text-sm ${message?.type === "error" ? "text-red-400" : "text-green-400"}`}>
      {message?.text}
    </p>
  </div>
);
