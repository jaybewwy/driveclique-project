import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, Users, Calendar, CheckCircle, TrendingUp,
  Car, Star, Award, AlertCircle, Plus,
  Home, User as UserIcon, ChevronDown, ChevronRight,
  MapPin, Clock, XCircle, ThumbsUp,
  Save, X, ShieldAlert, Pencil
} from "lucide-react";
import NavBar from "../components/NavBar";
import { drivesAPI, authAPI, getErrorMessage } from "../services/api";
import { LocationSearch } from "../components/ui/location-search";

/* ─── Sidebar ─────────────────────────────────────────────────────────── */

const AnalyticsSidebar = ({ user, activeView, onViewChange }) => {
  const navigate = useNavigate();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const displayName = user?.useDisplayName && user?.name ? user.name : user?.username;

  return (
    <div className="w-60 xl:w-64 2xl:w-72 flex-none hidden xl:flex flex-col border-r border-zinc-800/50 p-3 xl:p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden bg-black/20">
      {/* User info */}
      {displayName && (
        <div className="relative group mb-6">
          <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 backdrop-blur-sm rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-zinc-700/30 group-hover:ring-red-500/30 transition-all duration-300">
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-white">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate">@{user?.username}</p>
            </div>
          </div>
        </div>
      )}

      {/* Standard nav links */}
      <div className="space-y-1.5 mb-4">
        <div
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 transition-all duration-200 group"
        >
          <div className="p-1.5 rounded-lg group-hover:bg-zinc-800/30 transition-all duration-200">
            <Home className="w-5 h-5" />
          </div>
          <span className="text-sm">Home</span>
        </div>

        <div
          onClick={() => onViewChange("profile")}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
            activeView === "profile"
              ? "bg-zinc-800/60 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
          }`}
        >
          <div className="p-1.5 rounded-lg group-hover:bg-zinc-800/30 transition-all duration-200">
            <UserIcon className="w-5 h-5" />
          </div>
          <span className="text-sm">Profile</span>
          {activeView === "profile" && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
          )}
        </div>

        <div
          onClick={() => navigate("/my-clubs")}
          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 transition-all duration-200 group"
        >
          <div className="p-1.5 rounded-lg group-hover:bg-zinc-800/30 transition-all duration-200">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-sm">My Clubs</span>
        </div>
      </div>

      {/* Analytics accordion */}
      <div className="mb-4">
        <button
          onClick={() => setAnalyticsOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 text-white transition-all duration-200"
        >
          <div className="p-1.5 rounded-lg bg-zinc-800/50">
            <BarChart2 className="w-5 h-5 text-red-400" />
          </div>
          <span className="text-sm font-semibold flex-1 text-left">Analytics</span>
          {analyticsOpen
            ? <ChevronDown className="w-4 h-4 text-zinc-500" />
            : <ChevronRight className="w-4 h-4 text-zinc-500" />}
        </button>

        {analyticsOpen && (
          <div className="mt-1 ml-4 pl-4 border-l border-zinc-800/60 space-y-0.5">
            {/* Personal */}
            <button
              onClick={() => onViewChange("personal")}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                activeView === "personal"
                  ? "bg-zinc-800/60 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span className="text-sm">Personal</span>
              {activeView === "personal" && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
              )}
            </button>

            {/* Clubs */}
            <button
              onClick={() => onViewChange("clubs")}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                activeView === "clubs"
                  ? "bg-zinc-800/60 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
            >
              <Users className="w-4 h-4 text-red-400" />
              <span className="text-sm">Clubs</span>
              {activeView === "clubs" && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
              )}
            </button>

          </div>
        )}
      </div>

      {/* Premium card */}
      <div className="relative overflow-hidden p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-2xl border border-red-500/20 mt-auto">
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-400" />
          Premium
        </h3>
        <p className="text-xs text-zinc-400 mb-3">Unlock exclusive features and analytics</p>
        <button className="w-full py-2 px-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25">
          Upgrade Now
        </button>
      </div>
    </div>
  );
};

/* ─── Shared primitives ────────────────────────────────────────────────── */

const StatChip = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-zinc-800/60 rounded-2xl p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={15} className={accent} />
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
    </div>
    <span className={`text-2xl font-bold ${accent}`}>{value}</span>
  </div>
);

const DetailCard = ({ icon: Icon, label, children, accent = "text-zinc-400" }) => (
  <div className="bg-zinc-800/40 rounded-2xl p-4 flex flex-col gap-2 min-h-[120px]">
    <div className="flex items-center gap-2">
      <Icon size={15} className={accent} />
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
    </div>
    <div className="flex-1 flex flex-col justify-center">{children}</div>
  </div>
);

const CompletionBar = ({ rate }) => (
  <div className="mt-2">
    <div className="flex justify-between mb-1">
      <span className="text-xs text-zinc-500">Completion</span>
      <span className="text-xs font-semibold text-emerald-400">{rate}%</span>
    </div>
    <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  </div>
);

const RSVPBar = ({ rate }) => (
  <div className="mt-2">
    <div className="flex justify-between mb-1">
      <span className="text-xs text-zinc-500">Avg RSVP Rate</span>
      <span className="text-xs font-semibold text-blue-400">{rate}%</span>
    </div>
    <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  </div>
);

const SkeletonAnalyticsCard = () => (
  <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 animate-pulse">
    <div className="h-6 bg-zinc-800 rounded-lg w-48 mb-6" />
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[1, 2, 3].map(i => <div key={i} className="bg-zinc-800/60 rounded-2xl p-4 h-20" />)}
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-zinc-800/40 rounded-2xl p-4 h-28" />)}
    </div>
  </div>
);

const SkeletonPersonalCard = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="bg-zinc-800/60 rounded-2xl h-20" />)}
    </div>
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-zinc-800 rounded-xl h-16" />)}
    </div>
  </div>
);

/* ─── Status badge ─────────────────────────────────────────────────────── */

const STATUS_STYLES = {
  going:      "bg-green-500/15 text-green-400 border-green-500/20",
  maybe:      "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  "not-going":"bg-red-500/15 text-red-400 border-red-500/20",
  waitlisted: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const StatusBadge = ({ status }) => (
  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
    {status}
  </span>
);

/* ─── Personal view ────────────────────────────────────────────────────── */

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const PersonalAnalytics = ({ user }) => {
  const navigate = useNavigate();
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    drivesAPI.getMyRSVPs()
      .then(res => { if (res.data.success) setRsvps(res.data.rsvps); })
      .catch(err => setError(err?.response?.data?.message || "Failed to load drive history."))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  const upcoming = rsvps.filter(r =>
    !r.drive.isCancelled &&
    new Date(r.drive.date) >= now &&
    r.status !== "not-going"
  );

  const past = rsvps.filter(r =>
    r.drive.isCompleted || r.drive.isCancelled || new Date(r.drive.date) < now
  );

  // Summary stats
  const attended = rsvps.filter(r => r.status === "going" && r.drive.isCompleted).length;

  // Favourite club: most going RSVPs
  const clubCount = {};
  rsvps.forEach(r => {
    if (r.status === "going" && r.drive.club) {
      const id = r.drive.club._id;
      clubCount[id] = clubCount[id] || { name: r.drive.club.name, id, count: 0 };
      clubCount[id].count++;
    }
  });
  const favouriteClub = Object.values(clubCount).sort((a, b) => b.count - a.count)[0] || null;

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl">
          <UserIcon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Personal Analytics</h1>
          <p className="text-sm text-zinc-500">Your drive history &amp; participation stats</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-2xl p-4 mb-6">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {loading && <SkeletonPersonalCard />}

      {!loading && !error && (
        <>
          {/* Summary stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatChip icon={Calendar}    label="Total RSVPs"  value={rsvps.length}     accent="text-red-400" />
            <StatChip icon={CheckCircle} label="Attended"     value={attended}          accent="text-emerald-400" />
            <StatChip icon={TrendingUp}  label="Upcoming"     value={upcoming.length}   accent="text-blue-400" />
            <div className="bg-zinc-800/60 rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <Star size={15} className="text-yellow-400" />
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Fav Club</span>
              </div>
              {favouriteClub ? (
                <button
                  onClick={() => navigate(`/club/${favouriteClub.id}`)}
                  className="text-sm font-bold text-yellow-400 truncate text-left hover:underline"
                >
                  {favouriteClub.name}
                </button>
              ) : (
                <span className="text-sm font-bold text-zinc-600">—</span>
              )}
            </div>
          </div>

          {/* Drive history list */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
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

            {/* Empty state */}
            {list.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <Car size={32} className="text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">
                  {tab === "upcoming"
                    ? "No upcoming drives. Find a club and RSVP!"
                    : "No past drives yet."}
                </p>
              </div>
            )}

            {/* Drive rows */}
            <div className="space-y-3">
              {list.map(rsvp => {
                const drive = rsvp.drive;
                const isPast = drive.isCompleted || drive.isCancelled || new Date(drive.date) < now;
                return (
                  <div
                    key={rsvp._id}
                    onClick={() => drive.club?._id && navigate(`/club/${drive.club._id}`)}
                    className="flex items-start gap-4 p-4 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-2xl cursor-pointer transition-all duration-200 group"
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-800 flex flex-col items-center justify-center border border-zinc-700/40">
                      <span className="text-xs text-zinc-500 leading-none">
                        {new Date(drive.date).toLocaleString("en-US", { month: "short" })}
                      </span>
                      <span className="text-lg font-bold text-white leading-tight">
                        {new Date(drive.date).getDate()}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-sm text-white truncate">{drive.name}</p>
                        {drive.isCancelled && (
                          <span className="text-xs text-red-400 flex items-center gap-0.5">
                            <XCircle size={11} /> Cancelled
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
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
                            <Clock size={11} /> {drive.time}
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
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Club analytics view (existing) ──────────────────────────────────── */

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
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl">
          <BarChart2 size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Club Analytics</h1>
          <p className="text-sm text-zinc-500">Performance insights for your clubs</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-2xl p-4 mb-6">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-6">
          <SkeletonAnalyticsCard />
          <SkeletonAnalyticsCard />
        </div>
      )}

      {!loading && !error && analytics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-5 bg-zinc-900 rounded-3xl mb-6 border border-zinc-800/50">
            <BarChart2 size={40} className="text-zinc-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No analytics yet</h2>
          <p className="text-zinc-500 text-sm mb-6 max-w-xs">
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
          {analytics.map(({ club, totalDrives, completedDrives, cancelledDrives, completionRate, avgRSVPRate, mostPopularDrive, mostActiveMember }) => (
            <div
              key={club._id}
              className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 hover:border-zinc-700/50 transition-all duration-300"
            >
              {/* Club header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center font-bold text-sm">
                    {club.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">{club.name}</h2>
                    <span className="text-xs text-zinc-500">
                      {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors duration-200 underline underline-offset-2"
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
                    <span className="text-xs text-zinc-500 uppercase tracking-wide">Completed</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-400">{completedDrives}</span>
                  <CompletionBar rate={completionRate} />
                </div>
              </div>

              {/* Detail cards row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DetailCard icon={Star} label="Most Popular Drive" accent="text-yellow-400">
                  {mostPopularDrive ? (
                    <>
                      <p className="font-semibold text-sm leading-snug">{mostPopularDrive.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{formatDate(mostPopularDrive.date)}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Users size={12} className="text-green-400" />
                        <span className="text-xs text-green-400 font-medium">{mostPopularDrive.goingCount} going</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">No drives with RSVPs yet</p>
                  )}
                </DetailCard>

                <DetailCard icon={Award} label="Most Active Member" accent="text-purple-400">
                  {mostActiveMember ? (
                    <>
                      <p className="font-semibold text-sm">{mostActiveMember.name || `@${mostActiveMember.username}`}</p>
                      <p className="text-xs text-zinc-500">@{mostActiveMember.username}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Car size={12} className="text-purple-400" />
                        <span className="text-xs text-purple-400 font-medium">
                          {mostActiveMember.rsvpCount} drive{mostActiveMember.rsvpCount !== 1 ? "s" : ""} attended
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">No RSVPs recorded yet</p>
                  )}
                </DetailCard>

                <DetailCard icon={TrendingUp} label="Avg RSVP Rate" accent="text-blue-400">
                  {totalDrives > 0 && cancelledDrives < totalDrives ? (
                    <>
                      <span className="text-3xl font-bold text-blue-400">{avgRSVPRate}%</span>
                      <RSVPBar rate={avgRSVPRate} />
                      {cancelledDrives > 0 && (
                        <p className="text-xs text-zinc-600 mt-1">{cancelledDrives} cancelled excluded</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">
                      {totalDrives === 0 ? "No drives scheduled yet" : "All drives cancelled"}
                    </p>
                  )}
                </DetailCard>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Profile view ─────────────────────────────────────────────────────── */

const COOLDOWN_DAYS = 60;

const ProfileView = ({ onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", username: "", email: "", location: "",
  });
  const [usernameChangedAt, setUsernameChangedAt] = useState(null);
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [daysLeft,          setDaysLeft]          = useState(0);

  // Username edit state
  const [editingUsername,  setEditingUsername]  = useState(false);
  const [newUsername,      setNewUsername]      = useState("");
  const [usernameError,    setUsernameError]    = useState("");
  const [changingUsername, setChangingUsername] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState("");
  const [deleteError, setDeleteError]         = useState("");
  const [isDeleting, setIsDeleting]           = useState(false);

  const applyCooldown = (changedAt) => {
    if (!changedAt) { setCanChangeUsername(true); setDaysLeft(0); return; }
    const days = (Date.now() - new Date(changedAt).getTime()) / (1000 * 60 * 60 * 24);
    const eligible = days >= COOLDOWN_DAYS;
    setCanChangeUsername(eligible);
    setDaysLeft(eligible ? 0 : Math.ceil(COOLDOWN_DAYS - days));
  };

  useEffect(() => {
    authAPI.getProfile()
      .then(res => {
        if (res.data.success) {
          const u = res.data.user;
          setFormData({
            firstName: u.firstName || "",
            lastName:  u.lastName  || "",
            username:  u.username  || "",
            email:     u.email     || "",
            location:  u.location  || "",
          });
          setUsernameChangedAt(u.usernameChangedAt || null);
          applyCooldown(u.usernameChangedAt || null);
        }
      })
      .catch(err => { if (err.response?.status === 401) navigate("/login"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) return;
    setChangingUsername(true);
    setUsernameError("");
    try {
      const res = await authAPI.changeUsername(newUsername.trim());
      if (res.data.success) {
        setFormData(prev => ({ ...prev, username: res.data.user.username }));
        setUsernameChangedAt(res.data.user.usernameChangedAt);
        applyCooldown(res.data.user.usernameChangedAt);
        setEditingUsername(false);
        setNewUsername("");
        setMessage({ type: "success", text: "Username updated successfully!" });
        if (onUpdateUser) onUpdateUser({ username: res.data.user.username });
      }
    } catch (err) {
      setUsernameError(getErrorMessage(err));
    } finally {
      setChangingUsername(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await authAPI.updateProfile({
        firstName: formData.firstName,
        lastName:  formData.lastName,
        location:  formData.location,
      });
      if (res.data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        if (onUpdateUser) onUpdateUser(res.data.user);
      }
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await authAPI.deleteAccount(deletePassword);
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("driveclique_user");
      onLogout();
      navigate("/login");
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-zinc-800 rounded-lg w-48 mb-8" />
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-zinc-800 rounded-xl h-12" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl">
          <UserIcon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          <p className="text-sm text-zinc-500">Update your account information</p>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-2xl ${
          message.type === "success"
            ? "bg-green-900/30 border border-green-600"
            : "bg-red-900/30 border border-red-600"
        }`}>
          <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
            {message.text}
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 space-y-4">

          {/* First + Last name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="pv-firstName" className="block text-sm font-medium text-zinc-300 mb-2">
                First Name
              </label>
              <input
                id="pv-firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Jay"
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="pv-lastName" className="block text-sm font-medium text-zinc-300 mb-2">
                Last Name
              </label>
              <input
                id="pv-lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Wells"
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-zinc-300">Username</label>
              {canChangeUsername && !editingUsername && (
                <button
                  type="button"
                  onClick={() => { setEditingUsername(true); setNewUsername(formData.username); setUsernameError(""); }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <Pencil size={11} /> Change
                </button>
              )}
              {!canChangeUsername && (
                <span className="text-xs text-zinc-500">
                  Available in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {editingUsername ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => { setNewUsername(e.target.value); setUsernameError(""); }}
                  placeholder="new_username"
                  autoFocus
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                />
                {usernameError && <p className="text-red-400 text-xs">{usernameError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleChangeUsername}
                    disabled={changingUsername || !newUsername.trim()}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={14} />
                    {changingUsername ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingUsername(false); setUsernameError(""); }}
                    className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={formData.username}
                disabled
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
              />
            )}

            <p className="text-xs text-zinc-500 mt-1">
              {usernameChangedAt
                ? `Last changed ${new Date(usernameChangedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Can be changed once every 60 days.`
                : "Can be changed once every 60 days."}
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="pv-email" className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              id="pv-email"
              type="email"
              name="email"
              value={formData.email}
              disabled
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
            />
            <p className="text-xs text-zinc-500 mt-1">Email cannot be changed.</p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Location</label>
            <LocationSearch
              value={formData.location}
              onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
            />
            <p className="text-xs text-zinc-500 mt-1">Used to suggest nearby clubs.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 px-8 py-3 rounded-2xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="border-t border-zinc-800 pt-8">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-500">Danger Zone</h2>
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button
            type="button"
            onClick={() => { setShowDeleteModal(true); setDeletePassword(""); setDeleteError(""); }}
            className="border border-red-600 text-red-500 hover:bg-red-600 hover:text-white px-6 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200"
          >
            Delete Account
          </button>
        </div>
      </form>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-zinc-800 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <X className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold">Delete Account</h2>
            </div>

            <p className="text-zinc-400 text-sm mb-3">This will permanently:</p>
            <ul className="text-zinc-400 text-sm mb-5 space-y-1 list-disc list-inside">
              <li>Delete your account and profile</li>
              <li>Remove you from all clubs</li>
              <li>Cancel all your future RSVPs</li>
            </ul>
            <p className="text-zinc-500 text-xs mb-5 bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-700/50">
              This action <span className="text-white font-semibold">cannot be undone</span>. Enter your password to confirm.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteError(""); }}
                placeholder="Enter your password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
                onKeyDown={e => e.key === "Enter" && !isDeleting && handleDeleteAccount()}
              />
              {deleteError && <p className="text-red-400 text-sm mt-2">{deleteError}</p>}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium text-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deletePassword}
                className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Page shell ───────────────────────────────────────────────────────── */

const ClubAnalytics = ({ user, onLogout, onUpdateUser }) => {
  const [activeView, setActiveView] = useState("clubs");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <NavBar user={user} onLogout={onLogout} />
      <div className="flex flex-1">
        <AnalyticsSidebar user={user} activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
          {activeView === "personal" && <PersonalAnalytics user={user} />}
          {activeView === "clubs"    && <ClubsAnalytics />}
          {activeView === "profile"  && <ProfileView onLogout={onLogout} onUpdateUser={onUpdateUser} />}
        </main>
      </div>
    </div>
  );
};

export default ClubAnalytics;
