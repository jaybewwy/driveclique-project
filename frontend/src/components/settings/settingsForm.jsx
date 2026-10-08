// Layout and input primitives for the Profile Settings view. Club Settings'
// sections reuse the field and input ones.

export const settingsInputClass =
  "w-full bg-black border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition-colors";
export const settingsInputDisabledClass =
  "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed";

/** A titled settings group: description on the left, fields on the right */
export const SettingsSection = ({ title, description, children }) => (
  <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-10 py-8 border-b border-zinc-800/60 last:border-b-0">
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {description && <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{description}</p>}
    </div>
    <div className="space-y-5 max-w-xl">{children}</div>
  </div>
);

export const SettingsField = ({ label, htmlFor, hint, children }) => (
  <div>
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-300 mb-2">
        {label}
      </label>
    )}
    {children}
    {hint && <p className="text-xs text-zinc-400 mt-1.5">{hint}</p>}
  </div>
);

/** An on/off switch (role="switch") */
export const ToggleSwitch = ({ checked, onChange, disabled, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? "bg-red-600" : "bg-zinc-700"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-true-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

/** Inline edit controls: a primary action and Cancel */
export const InlineEditActions = ({ onConfirm, confirmDisabled, confirmIcon: Icon, confirmLabel, onCancel }) => (
  <div className="flex gap-2">
    <button
      type="button"
      onClick={onConfirm}
      disabled={confirmDisabled}
      className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icon size={14} />
      {confirmLabel}
    </button>
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
    >
      Cancel
    </button>
  </div>
);
