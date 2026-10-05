import { useState } from "react";
import { Globe, Lock } from "lucide-react";
import { useClubUpdate } from "../../hooks/useClubUpdate";
import { SaveBar, SettingsPanel } from "./SettingsPanel";

// What each setting does on the backend: browse/search and the trending club
// only list public clubs, joining a private club goes through the leader's
// approval queue (UC-10), and a private club's drive list is members-only.
const VISIBILITY_OPTIONS = [
  {
    isPrivate: false,
    label: "Public",
    icon: Globe,
    description: "Anyone can find this club in search and join right away. Any signed-in user can see its drives.",
  },
  {
    isPrivate: true,
    label: "Private",
    icon: Lock,
    description: "Hidden from search. People ask to join, a leader or co-leader approves them, and only members can see its drives.",
  },
];

/** Club Settings → Privacy: whether the club is public or private */
const PrivacySection = ({ club, onClubUpdated }) => {
  const [isPrivate, setIsPrivate] = useState(Boolean(club.isPrivate));
  const { saving, message, save } = useClubUpdate(club._id);

  const handleSave = async () => {
    const saved = await save({ isPrivate }, `This club is now ${isPrivate ? 'private' : 'public'}.`);
    if (saved) onClubUpdated({ isPrivate: saved.isPrivate });
  };

  return (
    <SettingsPanel title="Privacy" description="Who can find this club, join it, and see its drives.">
      <fieldset className="space-y-3">
        <legend className="sr-only">Club visibility</legend>
        {VISIBILITY_OPTIONS.map(({ isPrivate: value, label, icon: Icon, description }) => {
          const selected = isPrivate === value;
          return (
            <label
              key={label}
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-red-600/60 ${
                selected
                  ? "border-red-600 bg-red-600/10"
                  : "border-zinc-700 bg-black hover:border-zinc-500"
              }`}
            >
              <input
                type="radio"
                name="club-visibility"
                checked={selected}
                onChange={() => setIsPrivate(value)}
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

      <SaveBar
        onSave={handleSave}
        saving={saving}
        disabled={isPrivate === Boolean(club.isPrivate)}
        message={message}
      />
    </SettingsPanel>
  );
};

export default PrivacySection;
