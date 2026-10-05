import { useState } from "react";
import { Trash2 } from "lucide-react";
import { clubsAPI } from "../../services/api";
import { usePageOverlays } from "../../hooks/usePageOverlays";
import { DeleteClubDialog } from "../club/ClubConfirmDialogs";
import { SettingsPanel } from "./SettingsPanel";

/** Club Settings → Danger Zone: delete the club, confirmed by the leader's email */
const DangerZoneSection = ({ club, onClubDeleted }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const closeDeleteConfirm = () => setShowDeleteConfirm(false);

  usePageOverlays([[showDeleteConfirm, closeDeleteConfirm]]);

  // Errors propagate to DeleteClubDialog, which shows them
  const confirmDeleteClub = async (leaderEmail, reason) => {
    const response = await clubsAPI.delete(club._id, reason, leaderEmail);
    if (response.data?.success) onClubDeleted();
  };

  return (
    <SettingsPanel title="Danger Zone" description="Actions here are permanent.">
      <div className="bg-red-900/20 border border-red-600 rounded-xl p-4">
        <p className="text-red-300 text-sm mb-3">
          Permanently delete this club and all associated data. This action cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
        >
          <Trash2 size={16} />
          Delete Club
        </button>
      </div>

      {showDeleteConfirm && (
        <DeleteClubDialog onConfirm={confirmDeleteClub} onClose={closeDeleteConfirm} />
      )}
    </SettingsPanel>
  );
};

export default DangerZoneSection;
