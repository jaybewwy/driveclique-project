import { SettingsSection, ToggleSwitch } from "./settingsForm";

// Labels shown in the Notifications settings section. Keys must match
// backend/models/notification.js's NOTIFICATION_TYPES exactly.
const NOTIFICATION_PREFERENCE_OPTIONS = [
  { type: "NEW_DRIVE", label: "A new drive is scheduled in one of your clubs" },
  { type: "RSVP_NEW", label: "A member RSVPs to a drive you created" },
  { type: "RSVP_UPDATED", label: "A member changes their RSVP on a drive you created" },
  { type: "WAITLIST_JOINED", label: "You're added to a drive's waitlist" },
  { type: "WAITLIST_PROMOTED", label: "You're promoted off a waitlist" },
  { type: "DRIVE_CANCELLED", label: "A drive you RSVPed to is cancelled" },
  { type: "DRIVE_REMINDER", label: "Reminders for upcoming drives" },
  { type: "DRIVE_CHECKIN_REQUEST", label: "A leader requests check-in for a drive" },
  { type: "JOIN_REQUEST", label: "Someone requests to join your club" },
  { type: "JOIN_ACCEPTED", label: "Your request to join a club is accepted" },
  { type: "JOIN_REJECTED", label: "Your request to join a club is declined" },
  { type: "NEW_ANNOUNCEMENT", label: "A club posts a new announcement" },
  { type: "COLEADER_PROMOTED", label: "You're promoted to co-leader" },
  { type: "COLEADER_DEMOTED", label: "You're removed as co-leader" },
  { type: "DRIVE_PHOTOS_ADDED", label: "New photos are added to a drive you went on" },
];

/** `preferences` is useNotificationPreferences()'s result */
const NotificationPreferencesSection = ({ preferences }) => {
  const { prefs, savingType, error, toggle } = preferences;
  return (
    <SettingsSection
      title="Notifications"
      description="Choose which notifications you receive. Turning one off applies going forward — it won't remove your past history."
    >
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-black border border-zinc-800 rounded-xl divide-y divide-zinc-800">
        {NOTIFICATION_PREFERENCE_OPTIONS.map(({ type, label }) => {
          const enabled = prefs[type] !== false;
          return (
            <div key={type} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-zinc-300 pr-4">{label}</span>
              <ToggleSwitch
                checked={enabled}
                ariaLabel={label}
                disabled={savingType === type}
                onChange={(value) => toggle(type, value)}
              />
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
};

export default NotificationPreferencesSection;
