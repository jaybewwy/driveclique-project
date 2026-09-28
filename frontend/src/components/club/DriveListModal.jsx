import { Calendar, Clock, MapPin } from "lucide-react";
import { formatDriveDate, formatDriveTimeLabel } from "../../lib/dateUtils";
import { ClubListDialog } from "./ClubDialogs";

/** "3/8" pill for a drive that's one occurrence of a recurring series (UC-11) */
export const RecurrenceBadge = ({ recurrence }) => (
  <span className="text-[10px] uppercase tracking-wide bg-zinc-700 text-zinc-300 rounded-full px-2 py-0.5 shrink-0">
    {recurrence.index}/{recurrence.total}
  </span>
);

const DriveMeta = ({ drive }) => (
  <div className="space-y-1 text-xs text-zinc-400">
    <div className="flex items-center gap-2">
      <Calendar size={12} />
      <span>{formatDriveDate(drive)}</span>
    </div>
    {drive.time && (
      <div className="flex items-center gap-2">
        <Clock size={12} />
        <span>{formatDriveTimeLabel(drive)}</span>
      </div>
    )}
    {drive.location && (
      <div className="flex items-center gap-2 min-w-0">
        <MapPin size={12} className="shrink-0" />
        <span className="truncate min-w-0">{drive.location}</span>
      </div>
    )}
  </div>
);

/**
 * A club's full list of upcoming drives, or its past ones. Picking a drive
 * calls onSelect(drive); `canOpen` false leaves the rows visible but inert.
 * `showStatus` adds the recurrence and "Completed" badges (past list).
 */
export const DriveListModal = ({ titleId, title, closeLabel, drives, canOpen = true, showStatus = false, onSelect, onClose }) => (
  <ClubListDialog titleId={titleId} title={title} closeLabel={closeLabel} onClose={onClose}>
    {drives.map((drive) => (
      <button
        type="button"
        key={drive._id}
        disabled={!canOpen}
        onClick={() => {
          if (!canOpen) return;
          onSelect(drive);
        }}
        className={`w-full text-left bg-black rounded-2xl p-4 transition ${canOpen ? 'cursor-pointer hover:bg-zinc-800' : 'cursor-default opacity-80'}`}
      >
        {showStatus ? (
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-sm flex items-center gap-2">
              {drive.name}
              {drive.recurrence && <RecurrenceBadge recurrence={drive.recurrence} />}
            </p>
            {drive.isCompleted && (
              <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full">
                Completed
              </span>
            )}
          </div>
        ) : (
          <p className="font-medium text-sm mb-2">{drive.name}</p>
        )}
        <DriveMeta drive={drive} />
      </button>
    ))}
  </ClubListDialog>
);
