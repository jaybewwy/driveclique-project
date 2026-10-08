import { useState } from "react";
import { Crown } from "lucide-react";
import { clubsAPI } from "../../services/api";
import { displayName, idOf } from "../../lib/userDisplay";
import { SettingsPanel } from "./SettingsPanel";

/**
 * Club Settings → Ownership: hand the club to another member.
 * onOwnershipTransferred(club) receives the server's updated club; the
 * viewer is no longer its leader by then.
 */
const OwnershipSection = ({ club, currentUserId, onOwnershipTransferred }) => {
  const [target, setTarget] = useState(null);
  const [error, setError] = useState('');

  const otherMembers = (club.members || []).filter((m) => idOf(m) !== currentUserId);

  const transfer = async () => {
    if (!target) return;
    setError('');
    try {
      const response = await clubsAPI.transfer(club._id, target._id);
      if (response.data?.success) onOwnershipTransferred(response.data.club);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  return (
    <SettingsPanel
      title="Ownership"
      description="Select a member to become the new club leader. You will become a regular member."
    >
      {otherMembers.length === 0 ? (
        <p className="text-sm text-zinc-400 bg-zinc-900 rounded-xl p-4">
          This club has no other members yet. Someone has to join before you can hand it over.
        </p>
      ) : (
        <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
          {otherMembers.map((member) => (
            <button
              key={member._id}
              type="button"
              onClick={() => setTarget(member)}
              aria-pressed={target?._id === member._id}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                target?._id === member._id
                  ? 'bg-amber-500/20 border border-amber-500/50'
                  : 'bg-zinc-800 hover:bg-zinc-700 border border-transparent'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {member.avatar
                  ? <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold">{member.username?.charAt(0)?.toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(member)}</p>
                <p className="text-xs text-zinc-400">@{member.username}</p>
              </div>
              {target?._id === member._id && (
                <Crown size={14} className="text-amber-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-red-400 text-sm mb-2">{error}</p>}

      {otherMembers.length > 0 && (
        <button
          type="button"
          onClick={transfer}
          disabled={!target}
          className="bg-amber-700 hover:bg-amber-800 px-6 py-2.5 rounded-xl font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        >
          <Crown size={15} />
          Transfer to {target ? displayName(target) : '...'}
        </button>
      )}
    </SettingsPanel>
  );
};

export default OwnershipSection;
