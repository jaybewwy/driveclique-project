import { CheckCircle, CalendarDays, Clock, X } from 'lucide-react';

// Canonical RSVP color mapping — green/going, yellow/maybe, red/not-going —
// matching DriveDetailModal.jsx's original palette (the more established,
// more heavily-tested surface; see 00-audit.md §3.D and §5 item 6).
// Calendar.jsx previously drifted to its own emerald/amber/zinc scheme for
// the same three states; this is the one shared source for both now.
const OPTIONS = [
  { status: 'going', label: 'Going', icon: CheckCircle, color: 'green' },
  { status: 'maybe', label: 'Maybe', icon: CalendarDays, color: 'yellow' },
  { status: 'not-going', label: 'Not Going', icon: X, color: 'red' },
];

const BASE_CLASSES = {
  default: 'flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
  compact: 'flex-1 text-[11px] font-medium px-2 py-1.5 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed',
};

const ACTIVE_CLASSES = {
  default: {
    green: 'bg-green-600 text-white',
    yellow: 'bg-yellow-600 text-white',
    red: 'bg-red-600 text-white',
  },
  compact: {
    green: 'bg-green-600/20 text-green-400 border-green-600/40',
    yellow: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40',
    red: 'bg-red-600/20 text-red-400 border-red-600/40',
  },
};

const INACTIVE_CLASSES = {
  default: {
    green: 'bg-zinc-800 hover:bg-green-900/30 text-white hover:text-green-400 border border-zinc-700 hover:border-green-600',
    yellow: 'bg-zinc-800 hover:bg-yellow-900/30 text-white hover:text-yellow-400 border border-zinc-700 hover:border-yellow-600',
    red: 'bg-zinc-800 hover:bg-red-900/30 text-white hover:text-red-400 border border-zinc-700 hover:border-red-600',
  },
  // Calendar's compact pills use one flat inactive style for all three
  // statuses (no per-color hover tint), matching its original design.
  compact: 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-white',
};

const GOING_AT_CAPACITY_CLASSES = 'bg-zinc-800 hover:bg-amber-900/30 text-white hover:text-amber-400 border border-zinc-700 hover:border-amber-600';

/**
 * The Going / Maybe / Not Going tri-state RSVP button row, shared between
 * DriveDetailModal.jsx (size="default") and Calendar.jsx (size="compact") —
 * previously two independently-drifted implementations (00-audit.md §3.D).
 * Only the color/state mapping and copy are shared; each size keeps its own
 * appropriate density (icons + large padding for the single-drive modal,
 * icon-free compact pills for Calendar's many-drives-per-page list).
 *
 * `goingAtCapacity` swaps just the Going button into an amber "Join
 * Waitlist" variant — a capacity-aware feature only DriveDetailModal
 * currently has the data (drive.maxAttendees + live counts) to compute;
 * Calendar.jsx omits the prop rather than gaining behavior it didn't have
 * before this extraction. Clicking it still submits 'going' — the server
 * decides whether that lands as 'going' or 'waitlisted' (Invariant #5).
 */
const RsvpButtonGroup = ({ status, isLoading, onSubmit, goingAtCapacity = false, size = 'default' }) => {
  const base = BASE_CLASSES[size];

  return (
    <div className="flex gap-3">
      {OPTIONS.map(({ status: optionStatus, label, icon: Icon, color }) => {
        const isGoingAtCapacity = optionStatus === 'going' && goingAtCapacity;
        const isActive = status === optionStatus && !isGoingAtCapacity;
        const colorClass = isGoingAtCapacity
          ? GOING_AT_CAPACITY_CLASSES
          : isActive
          ? ACTIVE_CLASSES[size][color]
          : (size === 'default' ? INACTIVE_CLASSES.default[color] : INACTIVE_CLASSES.compact);

        return (
          <button
            key={optionStatus}
            type="button"
            onClick={() => onSubmit(optionStatus)}
            disabled={isLoading}
            className={`${base} ${colorClass}`}
          >
            {size === 'default' && (isGoingAtCapacity ? <Clock size={18} /> : <Icon size={18} />)}
            {isGoingAtCapacity ? 'Join Waitlist' : label}
          </button>
        );
      })}
    </div>
  );
};

export default RsvpButtonGroup;
