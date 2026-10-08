import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { authAPI } from "../../services/api";
import { SettingsSection } from "./settingsForm";

const DeleteAccountModal = ({ onDeleted, onClose }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!password) return;
    setIsDeleting(true);
    setError("");
    try {
      await authAPI.deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-true-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-zinc-800 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <X className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-xl font-bold">Delete Account</h2>
        </div>

        <p className="text-zinc-400 text-sm mb-3">This will permanently:</p>
        <ul className="text-zinc-400 text-sm mb-5 space-y-1 list-disc list-inside">
          <li>Delete your account and profile</li>
          <li>Remove you from all clubs</li>
          <li>Cancel all your future RSVPs</li>
        </ul>
        <p className="text-zinc-400 text-xs mb-5 bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-700/50">
          This action <span className="text-white font-semibold">cannot be undone</span>. Enter your password to confirm.
        </p>

        <div className="mb-4">
          <label htmlFor="delete-account-password" className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
          <input
            id="delete-account-password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder=""
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
            onKeyDown={e => e.key === "Enter" && !isDeleting && confirmDelete()}
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium text-sm transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={isDeleting || !password}
            className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting…" : "Delete My Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

/** "Danger Zone": password-confirmed account deletion (UC-18) */
const DeleteAccountSection = ({ onDeleted }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <SettingsSection
        title="Danger Zone"
        description="Permanently delete your account and all associated data. This cannot be undone."
      >
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="border border-red-600 text-red-500 hover:bg-red-600 hover:text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
        >
          Delete Account
        </button>
      </SettingsSection>

      {/* Portaled out of the profile <form> this section sits in: otherwise
          Enter in the password field would also submit that form */}
      {showModal && createPortal(
        <DeleteAccountModal onDeleted={onDeleted} onClose={() => setShowModal(false)} />,
        document.body
      )}
    </>
  );
};

export default DeleteAccountSection;
