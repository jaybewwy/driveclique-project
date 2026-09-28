import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, BarChart2, Calendar, Car, CheckCircle, Plus, Star, TrendingUp, UserCheck, Users } from "lucide-react";
import { drivesAPI } from "../../services/api";
import { formatDriveDate } from "../../lib/dateUtils";
import { AnalyticsHeader, DetailCard, ErrorBanner, RateBar, SkeletonAnalyticsCard, StatChip } from "./analyticsUi";

// lg grid width by how many optional cards (attendance, rating) a club has
const DETAIL_GRID_COLS = ["lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5"];

const ClubAnalyticsCard = ({ summary, onViewClub }) => {
  const {
    club, totalDrives, completedDrives, cancelledDrives, completionRate,
    avgRSVPRate, avgAttendanceRate, avgDriveRating, mostPopularDrive, mostActiveMember,
  } = summary;
  const optionalCardCount = [avgAttendanceRate !== null, avgDriveRating !== null].filter(Boolean).length;

  return (
    <div className="glass-card rounded-3xl p-6 hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200">
      {/* Club header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center font-bold text-sm">
            {club.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">{club.name}</h2>
            <span className="text-xs text-zinc-400">
              {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <button
          onClick={() => onViewClub(club._id)}
          className="text-xs text-zinc-400 hover:text-red-400 transition-colors duration-200 underline underline-offset-2"
        >
          View Club
        </button>
      </div>

      {/* Stat chips row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatChip icon={Users}    label="Members"      value={club.memberCount} accent="text-red-400" />
        <StatChip icon={Calendar} label="Total Drives" value={totalDrives}      accent="text-orange-400" />
        <div className="bg-zinc-800/60 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={15} className="text-emerald-400" />
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Completed</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{completedDrives}</span>
          <RateBar label="Completion" rate={completionRate} color="emerald" />
        </div>
      </div>

      {/* Detail cards row */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${DETAIL_GRID_COLS[optionalCardCount]} gap-3`}>
        <DetailCard icon={Star} label="Most Popular Drive" accent="text-yellow-400">
          {mostPopularDrive ? (
            <>
              <p className="font-semibold text-sm leading-snug">{mostPopularDrive.name}</p>
              <p className="text-xs text-zinc-400 mt-1">{formatDriveDate(mostPopularDrive)}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <Users size={12} className="text-green-400" />
                <span className="text-xs text-green-400 font-medium">{mostPopularDrive.goingCount} going</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-400 italic">No drives with RSVPs yet</p>
          )}
        </DetailCard>

        <DetailCard icon={Award} label="Most Active Member" accent="text-purple-400">
          {mostActiveMember ? (
            <>
              <p className="font-semibold text-sm">{mostActiveMember.name || `@${mostActiveMember.username}`}</p>
              <p className="text-xs text-zinc-400">@{mostActiveMember.username}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <Car size={12} className="text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">
                  {mostActiveMember.rsvpCount} drive{mostActiveMember.rsvpCount !== 1 ? "s" : ""} attended
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-400 italic">No RSVPs recorded yet</p>
          )}
        </DetailCard>

        <DetailCard icon={TrendingUp} label="Avg RSVP Rate" accent="text-blue-400">
          {totalDrives > 0 && cancelledDrives < totalDrives ? (
            <>
              <span className="text-3xl font-bold text-blue-400">{avgRSVPRate}%</span>
              <RateBar label="Avg RSVP Rate" rate={avgRSVPRate} color="sky" />
              {cancelledDrives > 0 && (
                <p className="text-xs text-zinc-400 mt-1">{cancelledDrives} cancelled excluded</p>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-400 italic">
              {totalDrives === 0 ? "No drives scheduled yet" : "All drives cancelled"}
            </p>
          )}
        </DetailCard>

        {avgAttendanceRate !== null && (
          <DetailCard icon={UserCheck} label="Attendance Rate" accent="text-purple-400">
            <span className="text-3xl font-bold text-purple-400">{avgAttendanceRate}%</span>
            <RateBar label="Checked-In Attendance" rate={avgAttendanceRate} color="purple" />
            <p className="text-xs text-zinc-400 mt-1">Checked in vs. "going" RSVPs</p>
          </DetailCard>
        )}

        {avgDriveRating !== null && (
          <DetailCard icon={Star} label="Avg Drive Rating" accent="text-yellow-400">
            <div className="flex items-center gap-1.5">
              <Star size={20} className="text-yellow-400 fill-yellow-400" />
              <span className="text-3xl font-bold text-yellow-400">{avgDriveRating.toFixed(1)}</span>
              <span className="text-xs text-zinc-400">/ 5</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">From member ratings on completed drives</p>
          </DetailCard>
        )}
      </div>
    </div>
  );
};

/** Per-club performance for every club the user leads or co-leads (UC-20) */
const ClubsAnalytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    drivesAPI.getAnalytics()
      .then(res => { if (res.data.success) setAnalytics(res.data.analytics); })
      .catch(err => setError(err?.response?.data?.message || "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <AnalyticsHeader icon={BarChart2} title="Club Analytics" subtitle="Performance insights for your clubs" />

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div className="space-y-6">
          <SkeletonAnalyticsCard />
          <SkeletonAnalyticsCard />
        </div>
      )}

      {!loading && !error && analytics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-5 bg-zinc-900 rounded-3xl mb-6 border border-zinc-800/50">
            <BarChart2 size={40} className="text-zinc-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No analytics yet</h2>
          <p className="text-zinc-400 text-sm mb-6 max-w-xs">
            Create a club and schedule some drives to see performance insights here.
          </p>
          <button
            onClick={() => navigate("/create-club")}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold px-6 py-3 rounded-2xl transition-all duration-300"
          >
            <Plus size={18} /> Create a Club
          </button>
        </div>
      )}

      {!loading && !error && analytics.length > 0 && (
        <div className="space-y-6">
          {analytics.map((summary) => (
            <ClubAnalyticsCard
              key={summary.club._id}
              summary={summary}
              onViewClub={(clubId) => navigate(`/club/${clubId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClubsAnalytics;
