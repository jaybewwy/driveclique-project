import { useState } from "react";
import { Lock, Pencil, Save } from "lucide-react";
import { authAPI, getErrorMessage } from "../../services/api";
import { InlineEditActions, SettingsField, SettingsSection, settingsInputClass, settingsInputDisabledClass } from "./settingsForm";

const USERNAME_COOLDOWN_DAYS = 60;
const MIN_PASSWORD_LENGTH = 8;

// Whether the username can change yet, and if not, in how many days
const usernameCooldown = (changedAt) => {
  if (!changedAt) return { canChange: true, daysLeft: 0 };
  const days = (Date.now() - new Date(changedAt).getTime()) / (1000 * 60 * 60 * 24);
  const canChange = days >= USERNAME_COOLDOWN_DAYS;
  return { canChange, daysLeft: canChange ? 0 : Math.ceil(USERNAME_COOLDOWN_DAYS - days) };
};

const ChangeLink = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
  >
    <Pencil size={11} /> Change
  </button>
);

/**
 * Read-only username with an inline "Change" flow, limited to once every
 * USERNAME_COOLDOWN_DAYS. onChanged(user) gets the server's { username,
 * usernameChangedAt }.
 */
export const UsernameField = ({ username, changedAt, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { canChange, daysLeft } = usernameCooldown(changedAt);

  const save = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await authAPI.changeUsername(newUsername.trim());
      if (res.data.success) {
        setEditing(false);
        setNewUsername("");
        onChanged(res.data.user);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="pv-username" className="text-sm font-medium text-zinc-300">Username</label>
        {canChange && !editing && (
          <ChangeLink onClick={() => { setEditing(true); setNewUsername(username); setError(""); }} />
        )}
        {!canChange && (
          <span className="text-xs text-zinc-400">
            Available in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={newUsername}
            onChange={e => { setNewUsername(e.target.value); setError(""); }}
            placeholder=""
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus follows the user's own "Change" click, not page load
            autoFocus
            className={settingsInputClass}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <InlineEditActions
            onConfirm={save}
            confirmDisabled={saving || !newUsername.trim()}
            confirmIcon={Save}
            confirmLabel={saving ? "Saving…" : "Confirm"}
            onCancel={() => { setEditing(false); setError(""); }}
          />
        </div>
      ) : (
        <input
          id="pv-username"
          type="text"
          value={username}
          disabled
          className={settingsInputDisabledClass}
        />
      )}

      <p className="text-xs text-zinc-400 mt-1.5">
        {changedAt
          ? `Last changed ${new Date(changedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Can be changed once every ${USERNAME_COOLDOWN_DAYS} days.`
          : `Can be changed once every ${USERNAME_COOLDOWN_DAYS} days.`}
      </p>
    </div>
  );
};

/**
 * Read-only email with an inline change request (UC-28). The change only
 * takes effect once the link sent to the new address is clicked, so the
 * displayed email never updates here.
 */
export const EmailField = ({ email }) => {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requesting, setRequesting] = useState(false);

  const requestChange = async () => {
    if (!newEmail.trim()) return;
    setRequesting(true);
    setError("");
    try {
      const res = await authAPI.requestEmailChange(newEmail.trim());
      if (res.data.success) {
        setSuccess(res.data.message);
        setEditing(false);
        setNewEmail("");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="pv-email" className="text-sm font-medium text-zinc-300">Email</label>
        {!editing && (
          <ChangeLink onClick={() => { setEditing(true); setNewEmail(""); setError(""); setSuccess(""); }} />
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setError(""); }}
            placeholder="new@email.com"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus follows the user's own "Change" click, not page load
            autoFocus
            className={settingsInputClass}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <InlineEditActions
            onConfirm={requestChange}
            confirmDisabled={requesting || !newEmail.trim()}
            confirmIcon={Save}
            confirmLabel={requesting ? "Sending…" : "Send verification link"}
            onCancel={() => { setEditing(false); setError(""); }}
          />
        </div>
      ) : (
        <input
          id="pv-email"
          type="email"
          name="email"
          value={email}
          disabled
          className={settingsInputDisabledClass}
        />
      )}

      {success ? (
        <p className="text-xs text-green-400 mt-1.5">{success}</p>
      ) : (
        <p className="text-xs text-zinc-400 mt-1.5">Changing your email requires confirming a link sent to the new address.</p>
      )}
    </div>
  );
};

/**
 * Change password. The backend revokes every session on success, so
 * onChanged() should sign the user out.
 */
export const PasswordSection = ({ onChanged }) => {
  const [form, setForm] = useState({ current: "", new: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setError("");
    setSuccess("");
  };

  const submit = async () => {
    setError("");
    setSuccess("");
    if (form.new.length < MIN_PASSWORD_LENGTH) { setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (form.new !== form.confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await authAPI.changePassword(form.current, form.new);
      setForm({ current: "", new: "", confirm: "" });
      // Staying "logged in" would just mask a session that fails at its next
      // token refresh, so sign out immediately instead.
      setSuccess("Password updated. Signing you out for security — please log in again.");
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title="Security"
      description="Update your password. Choose something you haven't used in the last 5 changes."
    >
      {success && (
        <div className="p-3 rounded-xl bg-green-900/30 border border-green-600">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      <SettingsField label="Current Password">
        <input
          type="password"
          value={form.current}
          onChange={updateField("current")}
          placeholder=""
          className={settingsInputClass}
        />
      </SettingsField>

      <div className="grid grid-cols-2 gap-4">
        <SettingsField
          label="New Password"
          hint="Cannot be the same as any of your last 5 passwords."
        >
          <input
            type="password"
            value={form.new}
            onChange={updateField("new")}
            placeholder=""
            className={settingsInputClass}
          />
        </SettingsField>
        <SettingsField label="Confirm New Password">
          <input
            type="password"
            value={form.confirm}
            onChange={updateField("confirm")}
            placeholder=""
            className={settingsInputClass}
            onKeyDown={e => e.key === "Enter" && !saving && submit()}
          />
        </SettingsField>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !form.current || !form.new || !form.confirm}
          className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Lock size={15} />
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </SettingsSection>
  );
};
