import { useEffect, useState } from "react";
import { ShieldOff, Users } from "lucide-react";
import Modal from "../Modal";
import { clubsAPI, getErrorMessage } from "../../services/api";

// User-blocks-club — the reciprocal of a leader/co-leader's per-club ban
// (BannedMembersPanel.jsx): any user can block any club, not just leaders
// acting on members. Same context-free, fetch-on-open shape.
const BlockedClubsPanel = ({ isOpen, onClose }) => {
  const [blockedClubs, setBlockedClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setLoading(true);
    clubsAPI.getBlockedClubs()
      .then((res) => { if (res.data.success) setBlockedClubs(res.data.blockedClubs); })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleUnblock = async (clubId) => {
    setUnblockingId(clubId);
    setError("");
    try {
      const res = await clubsAPI.unblockClub(clubId);
      if (res.data?.success) {
        setBlockedClubs((prev) => prev.filter((c) => c._id !== clubId));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Blocked Clubs" size="sm">
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-4">{error}</p>
      ) : blockedClubs.length === 0 ? (
        <div className="text-center py-6">
          <ShieldOff className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">You haven't blocked any clubs.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blockedClubs.map((club) => (
            <div key={club._id} className="flex items-center justify-between gap-3 bg-black/30 rounded-xl p-3">
              <div className="flex items-center gap-3 min-w-0">
                {club.avatar ? (
                  <img src={club.avatar} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {club.name?.[0]?.toUpperCase() || <Users size={14} />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{club.name}</p>
                  {club.location && <p className="text-xs text-zinc-500 truncate">{club.location}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUnblock(club._id)}
                disabled={unblockingId === club._id}
                className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-red-600 hover:text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unblockingId === club._id ? 'Unblocking…' : 'Unblock'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default BlockedClubsPanel;
