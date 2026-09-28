import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import { authAPI, getErrorMessage } from "../../services/api";
import { LocationSearch } from "../ui/location-search";
import { SettingsField, SettingsSection, ToggleSwitch, settingsInputClass } from "./settingsForm";
import { EmailField, PasswordSection, UsernameField } from "./AccountFields";
import NotificationPreferencesSection from "./NotificationPreferences";
import { useNotificationPreferences } from "../../hooks/useNotificationPreferences";
import DeleteAccountSection from "./DeleteAccountSection";

const EMPTY_FORM = {
  firstName: "", lastName: "", username: "", email: "", location: "", name: "", useDisplayName: false,
};

const formFromUser = (u) => ({
  firstName: u.firstName || "",
  lastName:  u.lastName  || "",
  username:  u.username  || "",
  email:     u.email     || "",
  location:  u.location  || "",
  name:      u.name      || "",
  useDisplayName: u.useDisplayName || false,
});

const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-zinc-800 rounded-lg w-48 mb-8" />
    <div className="glass-card rounded-3xl p-6 space-y-4">
      {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-zinc-800 rounded-xl h-12" />)}
    </div>
  </div>
);

/**
 * Profile Settings: personal info (saved by the bottom "Save settings"
 * button), plus username, email, password, notification and account
 * deletion controls that each save on their own.
 */
const ProfileSettings = ({ onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [usernameChangedAt, setUsernameChangedAt] = useState(null);
  const notificationPreferences = useNotificationPreferences();

  useEffect(() => {
    authAPI.getProfile()
      .then(res => {
        if (res.data.success) {
          setFormData(formFromUser(res.data.user));
          setUsernameChangedAt(res.data.user.usernameChangedAt || null);
        }
      })
      .catch(err => { if (err.response?.status === 401) navigate("/login"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  // The backend has already revoked every session by this point, so clear
  // the local one before logging out
  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("driveclique_user");
    onLogout();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name" && formData.useDisplayName) {
      setFormData(prev => ({ ...prev, [name]: value, useDisplayName: false }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleUsernameChanged = (user) => {
    setFormData(prev => ({ ...prev, username: user.username }));
    setUsernameChangedAt(user.usernameChangedAt);
    setMessage({ type: "success", text: "Username updated successfully!" });
    if (onUpdateUser) onUpdateUser({ username: user.username });
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (formData.useDisplayName && !formData.name.trim()) {
      setMessage({ type: "error", text: "Please enter a display name before enabling 'Show Display Name'." });
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await authAPI.updateProfile({
        firstName: formData.firstName,
        lastName:  formData.lastName,
        location:  formData.location,
        name:      formData.name,
        useDisplayName: formData.useDisplayName,
      });
      if (res.data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        if (onUpdateUser) onUpdateUser(res.data.user);
      }
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your personal information, security, and account.</p>
      </div>

      {message.text && (
        <div className={`mt-6 p-4 rounded-2xl ${
          message.type === "success"
            ? "bg-green-900/30 border border-green-600"
            : "bg-red-900/30 border border-red-600"
        }`}>
          <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
            {message.text}
          </p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <SettingsSection
          title="Personal Information"
          description="Update your name, username, and where you're based."
        >
          <div className="grid grid-cols-2 gap-4">
            <SettingsField label="First Name" htmlFor="pv-firstName">
              <input
                id="pv-firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder=""
                className={settingsInputClass}
              />
            </SettingsField>
            <SettingsField label="Last Name" htmlFor="pv-lastName">
              <input
                id="pv-lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder=""
                className={settingsInputClass}
              />
            </SettingsField>
          </div>

          <SettingsField
            label="Display Name"
            htmlFor="pv-display-name"
            hint="This name will be shown to other users if you enable the option below."
          >
            <input
              id="pv-display-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder=""
              className={settingsInputClass}
            />
          </SettingsField>

          <div className="flex items-center justify-between bg-black border border-zinc-800 rounded-xl p-4">
            <div>
              <div className="text-sm font-medium text-zinc-300">Show Display Name</div>
              <div className="text-xs text-zinc-400 mt-1">
                Use your display name instead of username on Dashboard and member lists
              </div>
            </div>
            <ToggleSwitch
              checked={formData.useDisplayName}
              onChange={(value) => setFormData(prev => ({ ...prev, useDisplayName: value }))}
            />
          </div>

          <UsernameField
            username={formData.username}
            changedAt={usernameChangedAt}
            onChanged={handleUsernameChanged}
          />

          <EmailField email={formData.email} />

          <SettingsField label="Location" hint="Used to suggest nearby clubs.">
            <LocationSearch
              value={formData.location}
              onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
            />
          </SettingsField>
        </SettingsSection>

        <PasswordSection
          onChanged={() => {
            signOut();
            setTimeout(() => navigate("/login"), 1500);
          }}
        />

        <NotificationPreferencesSection preferences={notificationPreferences} />

        <DeleteAccountSection
          onDeleted={() => {
            signOut();
            navigate("/login");
          }}
        />

        {/* Bottom action bar */}
        <div className="flex justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-xl text-sm font-medium bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all duration-200"
          >
            Go back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 px-8 py-3 rounded-xl font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
