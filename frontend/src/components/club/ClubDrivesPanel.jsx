import { useState } from "react";
import { Calendar, CheckCircle, Edit3, MoreVertical, Trash2, X } from "lucide-react";
import { formatDriveDate, formatDriveTimeLabel } from "../../lib/dateUtils";
import { idOf } from "../../lib/userDisplay";
import { RecurrenceBadge } from "./DriveListModal";

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
  </svg>
);

const MenuItem = ({ onClick, className = "", children }) => (
  <button
    onClick={onClick}
    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition ${className}`}
  >
    {children}
  </button>
);

/**
 * The leader's "⋮" menu on a drive. The leader gets every action; a
 * co-leader only sees Cancel, and only on drives they created (UC-10).
 */
const DriveActionMenu = ({ isOpen, onToggle, isLeader, canCancel, onAction }) => (
  <div className="relative">
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="p-1 hover:bg-zinc-700 rounded-lg transition"
    >
      <MoreVertical size={14} className="text-zinc-400" />
    </button>
    {isOpen && (
      <div className="absolute right-0 top-8 bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 z-50 min-w-[140px]">
        {isLeader && (
          <MenuItem onClick={() => onAction('edit')} className="hover:bg-zinc-700 rounded-t-xl">
            <Edit3 size={14} />
            Edit
          </MenuItem>
        )}
        {isLeader && (
          <MenuItem onClick={() => onAction('complete')} className="hover:bg-zinc-700">
            <CheckCircle size={14} />
            Mark Complete
          </MenuItem>
        )}
        {canCancel && (
          <MenuItem onClick={() => onAction('cancel')} className="hover:bg-zinc-700">
            <X size={14} />
            Cancel Drive
          </MenuItem>
        )}
        {isLeader && (
          <MenuItem onClick={() => onAction('delete')} className="hover:bg-red-900/50 text-red-400 rounded-b-xl">
            <Trash2 size={14} />
            Delete
          </MenuItem>
        )}
      </div>
    )}
  </div>
);

/**
 * Sidebar "Drive and Events": the next two upcoming drives (with the
 * leader's action menu), plus buttons into the full upcoming and past lists.
 * `role` is getClubRole()'s result; `actions` holds onOpen, onEdit,
 * onComplete, onCancel, onDelete (each called with the drive), onViewAll,
 * and onViewPast.
 */
const ClubDrivesPanel = ({ upcomingDrives, pastDrives, role, actions }) => {
  const [openMenuDriveId, setOpenMenuDriveId] = useState(null);

  const runAction = (action, drive) => {
    setOpenMenuDriveId(null);
    if (action === 'edit') actions.onEdit(drive);
    else if (action === 'complete') actions.onComplete(drive);
    else if (action === 'cancel') actions.onCancel(drive);
    else if (action === 'delete') actions.onDelete(drive);
  };

  return (
    <div className="border-t border-zinc-800 pt-3 xl:pt-5 mt-3 xl:mt-5">
      <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">Drive and Events</h3>

      {upcomingDrives.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-zinc-400 text-sm">No drives scheduled yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 xl:space-y-3">
            {upcomingDrives.slice(0, 2).map((drive) => {
              const canCancel = role.isLeader || (role.isCoLeader && idOf(drive.createdBy) === role.userId);
              return (
                <div
                  key={drive._id}
                  className="bg-zinc-900/50 backdrop-blur-sm rounded-xl xl:rounded-2xl p-3 xl:p-4 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group relative overflow-visible"
                >
                  <div className="flex items-start justify-between">
                    <button
                      type="button"
                      disabled={!role.canViewDrives}
                      className={`flex-1 text-left ${role.canViewDrives ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => role.canViewDrives && actions.onOpen(drive)}
                    >
                      <h4 className="font-semibold mb-2 group-hover:text-red-400 transition-colors flex items-center gap-2">
                        {drive.name}
                        {drive.recurrence && <RecurrenceBadge recurrence={drive.recurrence} />}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDriveDate(drive)}
                        </span>
                        {drive.time && (
                          <span className="flex items-center gap-1">
                            <ClockIcon />
                            {formatDriveTimeLabel(drive)}
                          </span>
                        )}
                      </div>
                    </button>
                    {canCancel && (
                      <DriveActionMenu
                        isOpen={openMenuDriveId === drive._id}
                        onToggle={() => setOpenMenuDriveId(openMenuDriveId === drive._id ? null : drive._id)}
                        isLeader={role.isLeader}
                        canCancel={canCancel}
                        onAction={(action) => runAction(action, drive)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            {upcomingDrives.length > 3 && (
              <button
                onClick={actions.onViewAll}
                className="flex-1 text-red-500 hover:text-red-400 text-sm font-medium transition py-2 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-700/30"
              >
                View All ({upcomingDrives.length})
              </button>
            )}
            {pastDrives.length > 0 && (
              <button
                onClick={actions.onViewPast}
                className="flex-1 text-zinc-400 hover:text-zinc-400 text-sm font-medium transition py-2 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-700/30"
              >
                Past Events ({pastDrives.length})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ClubDrivesPanel;
