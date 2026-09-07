import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import Modal from "../Modal";
import { clubsAPI, getErrorMessage } from "../../services/api";

// UC-32 — leader/co-leader-only view of who's been banned from a club (via
// the "Also ban" checkbox on member removal), with an Unban action per row.
// Context-free like MemberProfilePanel — just a clubId in, a list out.
const BannedMembersPanel = ({ clubId, isOpen, onClose }) => {
  const [bannedUsers, setBannedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unbanningId, setUnbanningId] = useState(null);

  useEffect(() => {
    if (!isOpen || !clubId) return;
    setError("");
    setLoading(true);
    clubsAPI.getBannedMembers(clubId)
      .then((res) => { if (res.data.success) setBannedUsers(res.data.bannedUsers); })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isOpen, clubId]);

  const handleUnban = async (userId) => {
    setUnbanningId(userId);
    setError("");
    try {
      const res = await clubsAPI.unbanMember(clubId, userId);
      if (res.data?.success) {
        setBannedUsers((prev) => prev.filter((u) => u._id !== userId));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUnbanningId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Banned Members" size="sm">
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-4">{error}</p>
      ) : bannedUsers.length === 0 ? (
        <div className="text-center py-6">
          <Ban className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">No one is banned from this club.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bannedUsers.map((user) => {
            const displayName = user.useDisplayName && user.name ? user.name : user.username;
            return (
              <div key={user._id} className="flex items-center justify-between gap-3 bg-black/30 rounded-xl p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    <p className="text-xs text-zinc-500 truncate">@{user.username}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnban(user._id)}
                  disabled={unbanningId === user._id}
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-red-600 hover:text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {unbanningId === user._id ? 'Unbanning…' : 'Unban'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default BannedMembersPanel;
