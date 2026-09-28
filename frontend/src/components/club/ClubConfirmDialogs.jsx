import { useState } from "react";
import { ClubDialog, CompactDialog, CompactDialogActions } from "./ClubDialogs";

// Confirmation dialogs for ClubDetail. Each owns its form and error state,
// so unmounting (close/Escape) discards it. `onConfirm` does the work and
// may reject with an API error, whose message the dialog shows.

const apiErrorMessage = (error, fallback) => error.response?.data?.message || fallback;

export const LeaveClubDialog = ({ onConfirm, onClose }) => (
  <ClubDialog
    titleId="leave-club-modal-title"
    title="Leave Club"
    closeLabel="Dismiss leave-club confirmation"
    onClose={onClose}
    panelClassName="max-w-md border-zinc-800"
  >
    <div className="space-y-6">
      <p className="text-zinc-300 text-center text-lg">
        Are you sure you want to leave this club?
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
        >
          No
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
        >
          Yes
        </button>
      </div>
    </div>
  </ClubDialog>
);

export const DeleteDriveDialog = ({ drive, onConfirm, onClose }) => (
  <CompactDialog titleId="delete-drive-modal-title" title="Delete Drive">
    <p className="text-zinc-400 text-sm mb-6">
      Are you sure you want to delete <span className="text-white font-medium">{drive.name}</span>? This cannot be undone.
    </p>
    <CompactDialogActions onCancel={onClose} confirmLabel="Delete" onConfirm={onConfirm} />
  </CompactDialog>
);

/**
 * Cancel Drive (UC-10) — distinct from Delete: members are notified. The
 * leader can also cancel the rest of a recurring series (UC-11) from here.
 * onConfirm(reason, cancelWholeSeries)
 */
export const CancelDriveDialog = ({ drive, canCancelSeries, onConfirm, onClose }) => {
  const [reason, setReason] = useState("");
  const [cancelWholeSeries, setCancelWholeSeries] = useState(false);
  const [error, setError] = useState("");

  const remainingInSeries = drive.recurrence ? drive.recurrence.total - drive.recurrence.index : 0;

  const submit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for cancelling this drive");
      return;
    }
    try {
      await onConfirm(reason.trim(), cancelWholeSeries);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to cancel drive"));
    }
  };

  return (
    <CompactDialog titleId="cancel-drive-modal-title" title="Cancel Drive">
      <p className="text-zinc-400 text-sm mb-3">
        Cancelling <span className="text-white font-medium">{drive.name}</span> will notify every member who RSVPed. This cannot be undone.
      </p>
      <label htmlFor="cancel-drive-reason" className="block text-sm text-zinc-400 mb-2">Reason</label>
      <textarea
        id="cancel-drive-reason"
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(""); }}
        rows={3}
        placeholder="e.g. Bad weather in the forecast"
        className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none mb-3"
      />
      {canCancelSeries && remainingInSeries > 0 && (
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={cancelWholeSeries}
            onChange={(e) => setCancelWholeSeries(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-black accent-red-600"
          />
          <span className="text-sm text-zinc-400">
            Also cancel the remaining {remainingInSeries} drive(s) in this recurring series
          </span>
        </label>
      )}
      {error && (
        <p className="text-red-400 text-sm mb-3">{error}</p>
      )}
      <CompactDialogActions cancelLabel="Keep Drive" onCancel={onClose} confirmLabel="Cancel Drive" onConfirm={submit} />
    </CompactDialog>
  );
};

/** onConfirm(ban) — `ban` also keeps them from rejoining (UC-32) */
export const RemoveMemberDialog = ({ member, onConfirm, onClose }) => {
  const [ban, setBan] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      await onConfirm(ban);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to remove member"));
    }
  };

  return (
    <CompactDialog titleId="remove-member-modal-title" title="Remove Member">
      <p className="text-zinc-400 text-sm mb-2">
        Are you sure you want to remove <span className="text-white font-medium">@{member.username}</span> from this club?
      </p>
      <label className="flex items-center gap-2 text-sm text-zinc-400 mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={ban}
          onChange={(e) => setBan(e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-black text-red-600 focus:ring-red-600 focus:ring-offset-zinc-900"
        />
        Also ban this user from rejoining
      </label>
      {error && (
        <p className="text-red-400 text-sm mb-3 mt-3">{error}</p>
      )}
      <CompactDialogActions className="mt-4" onCancel={onClose} confirmLabel="Remove" onConfirm={submit} />
    </CompactDialog>
  );
};

/**
 * onConfirm(leaderEmail, reason) — the email must match the leader's; the
 * reason is optional (it's only logged)
 */
export const DeleteClubDialog = ({ onConfirm, onClose }) => {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim()) {
      setError("Please enter the club leader's email to confirm");
      return;
    }
    try {
      await onConfirm(email.trim(), reason.trim());
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete club"));
    }
  };

  return (
    <ClubDialog
      titleId="delete-club-modal-title"
      title="Delete Club"
      titleClassName="text-red-400"
      closeLabel="Dismiss club deletion form"
      onClose={onClose}
      panelClassName="max-w-md border-red-600"
    >
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-red-900/20 border border-red-600 rounded-xl p-4">
          <p className="text-red-300 text-sm">
            <strong>Warning:</strong> This action is permanent and cannot be undone. All club data, drives, and member information will be deleted.
          </p>
        </div>

        <div>
          <label htmlFor="delete-club-email" className="block text-sm text-zinc-400 mb-2">
            Confirm Leader Email
            <span className="text-zinc-400 text-xs ml-1">(Must match the club leader's email)</span>
          </label>
          <input
            id="delete-club-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="leader@example.com"
            className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
          />
        </div>

        <div>
          <label htmlFor="delete-club-reason" className="block text-sm text-zinc-400 mb-2">
            Reason for Deletion
            <span className="text-zinc-400 text-xs ml-1">(Optional, helps us improve)</span>
          </label>
          <textarea
            id="delete-club-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why are you deleting this club?"
            className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </ClubDialog>
  );
};
