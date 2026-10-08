import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { authAPI, getErrorMessage } from "../../services/api";
import { applyTheme, getTheme } from "../../lib/theme";
import { SettingsSection } from "./settingsForm";

const THEME_OPTIONS = [
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
    description: "Light text on a dark background. The original DriveClique look.",
  },
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Dark text on a light background. Easier to read in bright surroundings.",
  },
];

/**
 * Settings → Appearance: the light/dark theme. Picking one switches the page
 * straight away and saves the choice to the account, so there is no Save
 * button; the line under the options says how the save went.
 */
const AppearanceSettings = ({ onUpdateUser }) => {
  const [theme, setTheme] = useState(getTheme);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text }

  const choose = async (next) => {
    if (next === theme) return;

    setTheme(applyTheme(next));
    setStatus(null);
    setSaving(true);
    try {
      await authAPI.updateProfile({ theme: next });
      // Keep the cached session user in step with the account
      if (onUpdateUser) onUpdateUser({ theme: next });
      setStatus({ type: "success", text: `Saved. You'll get the ${next} theme wherever you sign in.` });
    } catch (err) {
      // The page has already switched; say plainly that only this device knows
      setStatus({
        type: "error",
        text: `This device is using the ${next} theme, but it couldn't be saved to your account: ${getErrorMessage(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-sm text-zinc-400 mt-1">Choose how DriveClique looks.</p>
      </div>

      <SettingsSection
        title="Theme"
        description="Applies as soon as you pick it and is saved to your account, so it follows you to any browser you sign in on."
      >
        <fieldset className="space-y-3">
          <legend className="sr-only">Theme</legend>
          {THEME_OPTIONS.map(({ value, label, icon: Icon, description }) => {
            const selected = theme === value;
            return (
              <label
                key={value}
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all focus-within:ring-2 focus-within:ring-red-600/60 ${
                  saving ? "cursor-wait" : "cursor-pointer"
                } ${
                  selected
                    ? "border-red-600 bg-red-600/10"
                    : "border-zinc-700 bg-black hover:border-zinc-500"
                }`}
              >
                {/* Disabled while a save is in flight, so two saves can't land out of order */}
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={selected}
                  disabled={saving}
                  onChange={() => choose(value)}
                  className="sr-only"
                />
                <Icon size={18} className={`mt-0.5 flex-shrink-0 ${selected ? "text-red-500" : "text-zinc-400"}`} />
                <span>
                  <span className={`block font-medium text-sm ${selected ? "text-white" : "text-zinc-400"}`}>{label}</span>
                  <span className="block text-xs text-zinc-400 mt-1">{description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {/* Always mounted, so screen readers announce the text when it arrives */}
        <p role="status" className={`text-sm ${status?.type === "error" ? "text-red-400" : "text-green-400"}`}>
          {status?.text}
        </p>
      </SettingsSection>
    </div>
  );
};

export default AppearanceSettings;
