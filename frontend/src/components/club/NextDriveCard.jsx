import { ArrowRight, Calendar, CalendarDays, Clock, Flag, MapPin, Users } from "lucide-react";
import { formatDriveDate, formatDriveTimeLabel } from "../../lib/dateUtils";

/**
 * The club's soonest upcoming drive, featured at the top of the page.
 * `rsvpCounts` is that drive's entry in the page's per-drive count map
 * ({ going, … } or { failed: true }); `moreCount` is how many other upcoming
 * drives follow it.
 */
const NextDriveCard = ({ drive, rsvpCounts, moreCount, canOpen, onOpen, onReport }) => (
  <div className="mb-8">
    <div className="relative mb-5">
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-orange-600/10 rounded-full blur-xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Next Scheduled Drive</h3>
            <p className="text-xs text-zinc-400">Don't miss out on the upcoming event</p>
          </div>
        </div>
      </div>
    </div>

    {/* Same shape as find-club/ClubResultCard: the drive's name is the button
        and its hit area covers the card, so the card isn't a button with the
        Report button nested inside it */}
    <div className={`relative glass-card p-4 transition-all duration-200 group rounded-2xl ${canOpen ? 'hover:border-white/[0.12] hover:-translate-y-0.5' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white group-hover:text-red-400 transition-colors mb-1.5">
            {canOpen ? (
              <button
                type="button"
                onClick={() => onOpen(drive)}
                className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-red-600"
              >
                {drive.name}
              </button>
            ) : drive.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDriveDate(drive)}
            </span>
            {drive.time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDriveTimeLabel(drive)}
              </span>
            )}
            {drive.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate max-w-[140px]">{drive.location}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {rsvpCounts?.failed ? (
                <span className="text-amber-400" title="Couldn't load attendee count">
                  — going
                </span>
              ) : (
                <>{rsvpCounts?.going ?? 0} going</>
              )}
            </span>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onReport(drive)}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
            title="Report drive"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>
          <div className="w-8 h-8 bg-white/[0.04] group-hover:bg-red-500/15 rounded-xl flex items-center justify-center transition-all">
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-red-400" />
          </div>
        </div>
      </div>
    </div>

    {moreCount > 0 && (
      <div className="mt-4 flex items-center justify-center">
        <div className="bg-zinc-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-700/30">
          <p className="text-zinc-400 text-sm">
            +{moreCount} more upcoming drive{moreCount > 1 ? 's' : ''}
          </p>
        </div>
      </div>
    )}
  </div>
);

export default NextDriveCard;
