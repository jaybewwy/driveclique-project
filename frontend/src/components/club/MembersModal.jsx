import { Ban, Crown, Flag, Shield, ShieldOff, X } from "lucide-react";
import { displayName } from "../../lib/userDisplay";
import { ClubListDialog } from "./ClubDialogs";

const primaryCarOf = (member) => member.cars?.find((c) => c.isPrimary) || member.cars?.[0];

const MemberRow = ({ member, isClubLeader, isCoLeader, role, currentUserId, actions }) => {
  const primaryCar = primaryCarOf(member);
  return (
    <div className="flex items-center gap-4 bg-black rounded-xl px-4 py-3">
      <div className="w-12 h-12 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0">
        {member.avatar ? (
          <img src={member.avatar} alt={member.username} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-zinc-400 text-sm">
              {member.username?.charAt(0)?.toUpperCase?.()}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => actions.onViewProfile(member._id)}
        className="flex-1 text-left hover:opacity-80 transition-opacity"
      >
        <p className="font-medium">{displayName(member)}</p>
        <p className="text-sm text-zinc-400">@{member.username}</p>
        {primaryCar && (primaryCar.year || primaryCar.make || primaryCar.model) && (
          <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
            {primaryCar.year} {primaryCar.make} {primaryCar.model}
          </p>
        )}
      </button>

      {isClubLeader ? (
        <span className="text-amber-500 text-sm flex items-center gap-1 bg-amber-900/30 px-3 py-1 rounded-full">
          <Crown size={12} /> Leader
        </span>
      ) : (
        <div className="flex items-center gap-1">
          {/* Co-Leader badge (UC-10) */}
          {isCoLeader && (
            <span className="text-sky-400 text-sm flex items-center gap-1 bg-sky-900/30 px-3 py-1 rounded-full">
              <Shield size={12} /> Co-Leader
            </span>
          )}
          {/* Report button — visible to any member for other members */}
          {member._id !== currentUserId && (
            <button
              type="button"
              onClick={() => actions.onReport(member)}
              className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
              title="Report member"
            >
              <Flag size={14} />
            </button>
          )}
          {/* Promote/Demote co-leader — leader only (UC-10) */}
          {role.isLeader && !isCoLeader && (
            <button
              type="button"
              onClick={() => actions.onPromote(member._id)}
              className="p-1.5 text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all"
              title="Promote to co-leader"
            >
              <Shield size={14} />
            </button>
          )}
          {role.isLeader && isCoLeader && (
            <button
              type="button"
              onClick={() => actions.onDemote(member._id)}
              className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
              title="Demote to member"
            >
              <ShieldOff size={14} />
            </button>
          )}
          {/* Remove button — leader or co-leader; a co-leader can't remove another co-leader */}
          {role.canModerate && (role.isLeader || !isCoLeader) && (
            <button
              type="button"
              onClick={() => actions.onRemove(member)}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Remove from club"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Everyone in the club, with the viewer's moderation actions per member.
 * `role` is getClubRole()'s result; `actions` holds onViewProfile(id),
 * onReport(member), onPromote(id), onDemote(id), onRemove(member), and
 * onShowBanned().
 */
export const MembersModal = ({ club, role, currentUserId, error, actions, onClose }) => (
  <ClubListDialog
    titleId="members-modal-title"
    title={`All Members (${club.members?.length || 0})`}
    closeLabel="Dismiss members list"
    onClose={onClose}
    header={(
      <>
        {role.canModerate && (
          <button
            type="button"
            onClick={actions.onShowBanned}
            className="text-xs text-zinc-400 hover:text-red-400 transition mb-4 -mt-2 self-start flex items-center gap-1.5"
          >
            <Ban size={12} /> View banned members
          </button>
        )}
        {error && (
          <p className="text-red-400 text-xs mb-3">{error}</p>
        )}
      </>
    )}
  >
    {(club.members || []).map((member) => (
      <MemberRow
        key={member._id}
        member={member}
        isClubLeader={Boolean(club.leader?._id && member._id === club.leader._id)}
        isCoLeader={role.isCoLeaderId(member._id)}
        role={role}
        currentUserId={currentUserId}
        actions={actions}
      />
    ))}
  </ClubListDialog>
);
