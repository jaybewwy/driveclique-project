import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, CalendarPlus, Calendar, Car, CheckCircle, Clock, MapPin,
  Star, ThumbsUp, TrendingUp, User as UserIcon, Users, XCircle,
} from "lucide-react";
import { drivesAPI, getErrorMessage } from "../../services/api";
import { getMyActivitySummary } from "../../services/analytics";
import { downloadBlobResponse } from "../../lib/downloadBlob";
import { formatDriveDate, formatDriveTimeLabel, hasDriveStarted } from "../../lib/dateUtils";
import { AnalyticsHeader, ErrorBanner, SkeletonPersonalCard, StatChip, StatusBadge } from "./analyticsUi";

const ACTIVITY_LABELS = {
  CLUB_CREATED:     "Clubs Created",
  CLUB_JOINED:      "Clubs Joined",
  DRIVE_SCHEDULED:  "Drives Scheduled",
  RSVP_SUBMITTED:   "RSVPs Submitted",
  RATING_SUBMITTED: "Ratings Given",
  REPORT_SUBMITTED: "Reports Filed",
};

// The club with the most "going" RSVPs, as { id, name, count }, or null
const favouriteClubOf = (rsvps) => {
  const clubCount = {};
  rsvps.forEach(r => {
    if (r.status === "going" && r.drive.club) {
      const id = r.drive.club._id;
      clubCount[id] = clubCount[id] || { name: r.drive.club.name, id, count: 0 };
      clubCount[id].count++;
    }
  });
  return Object.values(clubCount).sort((a, b) => b.count - a.count)[0] || null;
};

const DriveHistoryRow = ({ rsvp, now, onOpenClub }) => {
  const drive = rsvp.drive;
  const isPast = drive.isCompleted || drive.isCancelled || hasDriveStarted(drive, now);
  return (
    <button
      type="button"
      onClick={() => drive.club?._id && onOpenClub(drive.club._id)}
      className="w-full text-left flex items-start gap-4 p-4 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-2xl cursor-pointer transition-all duration-200 group"
    >
      {/* Date badge */}
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-800 flex flex-col items-center justify-center border border-zinc-700/40">
        <span className="text-xs text-zinc-400 leading-none">
          {formatDriveDate(drive, { month: "short" })}
        </span>
        <span className="text-lg font-bold text-white leading-tight">
          {formatDriveDate(drive, { day: "numeric" })}
        </span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-semibold text-sm text-white truncate min-w-0">{drive.name}</p>
          {drive.isCancelled && (
            <span className="text-xs text-red-400 flex items-center gap-0.5">
              <XCircle size={11} /> Cancelled
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
          {drive.club?.name && (
            <span className="flex items-center gap-1">
              <Users size={11} /> {drive.club.name}
            </span>
          )}
          {drive.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {drive.location}
            </span>
          )}
          {drive.time && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {formatDriveTimeLabel(drive)}
            </span>
          )}
        </div>
      </div>

      {/* Status + RSVP */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <StatusBadge status={rsvp.status} />
        {isPast && drive.isCompleted && rsvp.status === "going" && (
          <span className="text-xs text-emerald-400 flex items-center gap-0.5">
            <ThumbsUp size={10} /> Attended
          </span>
        )}
      </div>
    </button>
  );
};

/** The user's own RSVP history, participation stats, and .ics export */
const PersonalAnalytics = () => {
  const navigate = useNavigate();
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [activitySummary, setActivitySummary] = useState(null);
  const [isExportingSchedule, setIsExportingSchedule] = useState(false);
  const [scheduleExportError, setScheduleExportError] = useState("");

  useEffect(() => {
    drivesAPI.getMyRSVPs()
      .then(res => { if (res.data.success) setRsvps(res.data.rsvps); })
      .catch(err => setError(err?.response?.data?.message || "Failed to load drive history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getMyActivitySummary()
      .then((res) => { if (res.data?.success) setActivitySummary(res.data.summary); })
      // A failure here just means the "Your Activity" card doesn't render (activitySummary
      // stays null, distinct from a real all-zero summary) — not a fake fallback value —
      // but still worth logging rather than staying fully silent.
      .catch((error) => console.error('Failed to load activity summary:', error));
  }, []);

  const now = new Date();

  const upcoming = rsvps.filter(r =>
    !r.drive.isCancelled &&
    !hasDriveStarted(r.drive, now) &&
    r.status !== "not-going"
  );

  const past = rsvps.filter(r =>
    r.drive.isCompleted || r.drive.isCancelled || hasDriveStarted(r.drive, now)
  );

  const attended = rsvps.filter(r => r.status === "going" && r.drive.isCompleted).length;
  const favouriteClub = favouriteClubOf(rsvps);
  const list = tab === "upcoming" ? upcoming : past;

  const handleExportSchedule = async () => {
    setIsExportingSchedule(true);
    setScheduleExportError("");
    try {
      const response = await drivesAPI.exportMyScheduleIcs();
      downloadBlobResponse(response, "driveclique-schedule.ics");
    } catch (err) {
      setScheduleExportError(getErrorMessage(err));
    } finally {
      setIsExportingSchedule(false);
    }
  };

  return (
    <div>
      <AnalyticsHeader icon={UserIcon} title="Personal Analytics" subtitle="Your drive history & participation stats" />

      {error && <ErrorBanner message={error} />}

      {loading && <SkeletonPersonalCard />}

      {!loading && !error && (
        <>
          {/* Summary stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatChip icon={Calendar}    label="Total RSVPs"  value={rsvps.length}     accent="text-red-400" />
            <StatChip icon={CheckCircle} label="Attended"     value={attended}          accent="text-emerald-400" />
            <StatChip icon={TrendingUp}  label="Upcoming"     value={upcoming.length}   accent="text-blue-400" />
            <div className="bg-zinc-800/60 rounded-2xl p-4 flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Star size={15} className="text-yellow-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wide">Fav Club</span>
              </div>
              {favouriteClub ? (
                <button
                  onClick={() => navigate(`/club/${favouriteClub.id}`)}
                  className="text-sm font-bold text-yellow-400 truncate text-left hover:underline min-w-0"
                >
                  {favouriteClub.name}
                </button>
              ) : (
                <span className="text-sm font-bold text-zinc-400">—</span>
              )}
            </div>
          </div>

          {/* Drive history list */}
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex gap-2">
                {["upcoming", "past"].map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      tab === t
                        ? "bg-red-600 text-white"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    <span className="ml-1.5 text-xs opacity-70">
                      {t === "upcoming" ? upcoming.length : past.length}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleExportSchedule}
                disabled={isExportingSchedule || upcoming.length === 0}
                title={upcoming.length === 0 ? "No upcoming drives to export" : "Export your upcoming schedule as an .ics file"}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-zinc-400"
              >
                <CalendarPlus size={14} />
                {isExportingSchedule ? "Exporting…" : "Export My Schedule"}
              </button>
            </div>
            {scheduleExportError && (
              <p className="text-red-400 text-xs mb-4 -mt-3">{scheduleExportError}</p>
            )}

            {list.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <Car size={32} className="text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-400">
                  {tab === "upcoming"
                    ? "No upcoming drives. Find a club and RSVP!"
                    : "No past drives yet."}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {list.map(rsvp => (
                <DriveHistoryRow
                  key={rsvp._id}
                  rsvp={rsvp}
                  now={now}
                  onOpenClub={(clubId) => navigate(`/club/${clubId}`)}
                />
              ))}
            </div>
          </div>

          {activitySummary && (
            <div className="glass-card p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-red-400" />
                <p className="section-label">Your Activity</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(ACTIVITY_LABELS).map(([type, label]) => (
                  <div key={type}>
                    <p className="text-2xl font-bold text-white">{activitySummary[type] ?? 0}</p>
                    <p className="text-xs text-zinc-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PersonalAnalytics;
