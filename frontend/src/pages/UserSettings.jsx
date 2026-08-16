import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, Users, Calendar, CheckCircle, TrendingUp,
  Car, Star, Award, AlertCircle, Plus, Activity,
  Home, User as UserIcon, ChevronDown, ChevronRight,
  MapPin, Clock, XCircle, ThumbsUp, UserCheck,
  Save, X, Pencil, Lock
} from "lucide-react";
import NavBar from "../components/NavBar";
import { drivesAPI, authAPI, notificationsAPI, getErrorMessage } from "../services/api";
import { getMyActivitySummary } from "../services/analytics";
import { LocationSearch } from "../components/ui/location-search";
import { MobileDrawerButton, MobileDrawer } from "../components/ui/MobileDrawer";

const ACTIVITY_LABELS = {
  CLUB_CREATED:     "Clubs Created",
  CLUB_JOINED:      "Clubs Joined",
  DRIVE_SCHEDULED:  "Drives Scheduled",
  RSVP_SUBMITTED:   "RSVPs Submitted",
  RATING_SUBMITTED: "Ratings Given",
  REPORT_SUBMITTED: "Reports Filed",
};

/* ─── Sidebar ─────────────────────────────────────────────────────────── */

const SidebarSectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-3 mb-2">{children}</p>
);

const SidebarNavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
      active
        ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-900/30"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
    }`}
  >
    <Icon className={`w-[18px] h-[18px] ${active ? "text-white" : "text-zinc-400"}`} />
    <span className={`text-sm flex-1 ${active ? "font-semibold" : ""}`}>{label}</span>
  </button>
);

const AnalyticsSidebar = ({ user, activeView, onViewChange }) => {
  const navigate = useNavigate();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user?.useDisplayName && user?.name ? user.name : user?.username;

  const goTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const onViewChangeAndClose = (view) => {
    onViewChange(view);
    setMobileOpen(false);
  };

  const content = (
    <>
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Main */}
        <div>
          <SidebarSectionLabel>Main</SidebarSectionLabel>
          <div className="space-y-1">
            <SidebarNavItem icon={Home} label="Home" onClick={() => goTo("/dashboard")} />
            <SidebarNavItem
              icon={UserIcon}
              label="Profile"
              active={activeView === "profile"}
              onClick={() => onViewChangeAndClose("profile")}
            />
            <SidebarNavItem icon={Users} label="My Clubs" onClick={() => goTo("/my-clubs")} />
          </div>
        </div>

        {/* Analytics accordion */}
        <div>
          <SidebarSectionLabel>Analytics</SidebarSectionLabel>
          <button
            onClick={() => setAnalyticsOpen(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 transition-all duration-200"
          >
            <BarChart2 className="w-[18px] h-[18px] text-red-400" />
            <span className="text-sm font-medium flex-1 text-left">Menu Level</span>
            {analyticsOpen
              ? <ChevronDown className="w-4 h-4 text-zinc-400" />
              : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>

          {analyticsOpen && (
            <div className="mt-1 ml-3 pl-3 border-l border-zinc-800/60 space-y-1">
              <SidebarNavItem
                icon={UserIcon}
                label="Personal"
                active={activeView === "personal"}
                onClick={() => onViewChangeAndClose("personal")}
              />
              <SidebarNavItem
                icon={Users}
                label="Clubs"
                active={activeView === "clubs"}
                onClick={() => onViewChangeAndClose("clubs")}
              />
            </div>
          )}
        </div>
      </div>

      {/* User card pinned to bottom */}
      {displayName && (
        <button
          type="button"
          onClick={() => goTo("/profile")}
          className="w-full text-left flex items-center gap-3 px-3 py-3 mt-4 bg-zinc-900 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 cursor-pointer transition-all duration-300 flex-shrink-0"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-zinc-700/30">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-zinc-400" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-zinc-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate text-white">{displayName}</p>
            <p className="text-xs text-zinc-400 truncate">@{user?.username}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Settings navigation" className="w-60 xl:w-64 2xl:w-72 flex-none hidden xl:flex flex-col border-r border-zinc-800/50 p-3 xl:p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden bg-black/20">
        {content}
      </nav>

      {/* Mobile trigger + drawer (shown once the desktop sidebar is hidden below xl) */}
      <MobileDrawerButton onClick={() => setMobileOpen(true)} breakpointClass="xl:hidden" side="left" label="navigation" />
      <MobileDrawer isOpen={mobileOpen} onClose={() => setMobileOpen(false)} side="left">
        <div className="flex flex-col h-full">{content}</div>
      </MobileDrawer>
    </>
  );
};

/* ─── Shared primitives ────────────────────────────────────────────────── */

const StatChip = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-1 hover:border-white/[0.11] transition-all duration-200">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={13} className={accent} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
    <span className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</span>
  </div>
);

const DetailCard = ({ icon: Icon, label, children, accent = "text-zinc-400" }) => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-2 min-h-[110px] hover:border-white/[0.09] transition-all duration-200">
    <div className="flex items-center gap-1.5">
      <Icon size={13} className={accent} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
    <div className="flex-1 flex flex-col justify-center">{children}</div>
  </div>
);

const CompletionBar = ({ rate }) => (
  <div className="mt-2">
    <div className="flex justify-between mb-1.5">
      <span className="text-[11px] text-zinc-400">Completion</span>
      <span className="text-[11px] font-semibold text-emerald-400">{rate}%</span>
    </div>
    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  </div>
);

const RSVPBar = ({ rate }) => (
  <div className="mt-2">
    <div className="flex justify-between mb-1.5">
      <span className="text-[11px] text-zinc-400">Avg RSVP Rate</span>
      <span className="text-[11px] font-semibold text-sky-400">{rate}%</span>
    </div>
    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  </div>
);

const AttendanceBar = ({ rate }) => (
  <div className="mt-2">
    <div className="flex justify-between mb-1.5">
      <span className="text-[11px] text-zinc-400">Checked-In Attendance</span>
      <span className="text-[11px] font-semibold text-purple-400">{rate}%</span>
    </div>
    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  </div>
);

const SkeletonAnalyticsCard = () => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 animate-pulse">
    <div className="h-5 bg-white/[0.06] rounded-lg w-48 mb-6" />
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[1, 2, 3].map(i => <div key={i} className="bg-white/[0.04] rounded-2xl p-4 h-20" />)}
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-white/[0.03] rounded-2xl p-4 h-28" />)}
    </div>
  </div>
);

const SkeletonPersonalCard = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="bg-white/[0.04] rounded-2xl h-20" />)}
    </div>
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-white/[0.05] rounded-xl h-16" />)}
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

const PersonalAnalytics = ({ user: _user }) => {
  const navigate = useNavigate();
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [activitySummary, setActivitySummary] = useState(null);

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
          <p className="text-sm text-zinc-400">Your drive history &amp; participation stats</p>
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
                <p className="text-sm text-zinc-400">
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
                  <button
                    type="button"
                    key={rsvp._id}
                    onClick={() => drive.club?._id && navigate(`/club/${drive.club._id}`)}
                    className="w-full text-left flex items-start gap-4 p-4 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-2xl cursor-pointer transition-all duration-200 group"
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-800 flex flex-col items-center justify-center border border-zinc-700/40">
                      <span className="text-xs text-zinc-400 leading-none">
                        {new Date(drive.date).toLocaleString("en-US", { month: "short" })}
                      </span>
                      <span className="text-lg font-bold text-white leading-tight">
                        {new Date(drive.date).getDate()}
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
                  </button>
                );
              })}
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
          <p className="text-sm text-zinc-400">Performance insights for your clubs</p>
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
          {analytics.map(({ club, totalDrives, completedDrives, cancelledDrives, completionRate, avgRSVPRate, avgAttendanceRate, avgDriveRating, mostPopularDrive, mostActiveMember }) => (
            <div
              key={club._id}
              className="glass-card rounded-3xl p-6 hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200"
            >
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
                  onClick={() => navigate(`/club/${club._id}`)}
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
                  <CompletionBar rate={completionRate} />
                </div>
              </div>

              {/* Detail cards row */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${
                ["lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5"][
                  [avgAttendanceRate !== null, avgDriveRating !== null].filter(Boolean).length
                ]
              } gap-3`}>
                <DetailCard icon={Star} label="Most Popular Drive" accent="text-yellow-400">
                  {mostPopularDrive ? (
                    <>
                      <p className="font-semibold text-sm leading-snug">{mostPopularDrive.name}</p>
                      <p className="text-xs text-zinc-400 mt-1">{formatDate(mostPopularDrive.date)}</p>
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
                      <RSVPBar rate={avgRSVPRate} />
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
                    <AttendanceBar rate={avgAttendanceRate} />
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
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Profile view ─────────────────────────────────────────────────────── */

const SettingsSection = ({ title, description, children }) => (
  <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-10 py-8 border-b border-zinc-800/60 last:border-b-0">
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {description && <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{description}</p>}
    </div>
    <div className="space-y-5 max-w-xl">{children}</div>
  </div>
);

const SettingsField = ({ label, htmlFor, hint, children }) => (
  <div>
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-300 mb-2">
        {label}
      </label>
    )}
    {children}
    {hint && <p className="text-xs text-zinc-400 mt-1.5">{hint}</p>}
  </div>
);

const settingsInputClass =
  "w-full bg-black border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition-colors";
const settingsInputDisabledClass =
  "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed";

const COOLDOWN_DAYS = 60;

// Labels shown in the Notifications settings section. Keys must match
// backend/models/notification.js's NOTIFICATION_TYPES exactly.
const NOTIFICATION_PREFERENCE_OPTIONS = [
  { type: "NEW_DRIVE", label: "A new drive is scheduled in one of your clubs" },
  { type: "RSVP_NEW", label: "A member RSVPs to a drive you created" },
  { type: "RSVP_UPDATED", label: "A member changes their RSVP on a drive you created" },
  { type: "WAITLIST_JOINED", label: "You're added to a drive's waitlist" },
  { type: "WAITLIST_PROMOTED", label: "You're promoted off a waitlist" },
  { type: "DRIVE_CANCELLED", label: "A drive you RSVPed to is cancelled" },
  { type: "DRIVE_REMINDER", label: "Reminders for upcoming drives" },
  { type: "DRIVE_CHECKIN_REQUEST", label: "A leader requests check-in for a drive" },
  { type: "JOIN_REQUEST", label: "Someone requests to join your club" },
  { type: "JOIN_ACCEPTED", label: "Your request to join a club is accepted" },
  { type: "JOIN_REJECTED", label: "Your request to join a club is declined" },
  { type: "NEW_ANNOUNCEMENT", label: "A club posts a new announcement" },
  { type: "COLEADER_PROMOTED", label: "You're promoted to co-leader" },
  { type: "COLEADER_DEMOTED", label: "You're removed as co-leader" },
];

const ProfileView = ({ onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", username: "", email: "", location: "", name: "", useDisplayName: false,
  });
  const [usernameChangedAt, setUsernameChangedAt] = useState(null);
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [daysLeft,          setDaysLeft]          = useState(0);

  // Username edit state
  const [editingUsername,  setEditingUsername]  = useState(false);
  const [newUsername,      setNewUsername]      = useState("");
  const [usernameError,    setUsernameError]    = useState("");
  const [changingUsername, setChangingUsername] = useState(false);

  const [pwForm, setPwForm]     = useState({ current: "", new: "", confirm: "" });
  const [pwError, setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState("");
  const [deleteError, setDeleteError]         = useState("");
  const [isDeleting, setIsDeleting]           = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({});
  const [savingNotifType, setSavingNotifType] = useState(null);
  const [notifPrefsError, setNotifPrefsError] = useState("");

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
            name:      u.name      || "",
            useDisplayName: u.useDisplayName || false,
          });
          setUsernameChangedAt(u.usernameChangedAt || null);
          applyCooldown(u.usernameChangedAt || null);
        }
      })
      .catch(err => { if (err.response?.status === 401) navigate("/login"); })
      .finally(() => setLoading(false));

    notificationsAPI.getPreferences()
      .then(res => { if (res.data.success) setNotifPrefs(res.data.data.notificationPreferences || {}); })
      .catch(err => console.warn("Failed to load notification preferences, defaulting to all enabled:", err));
  }, [navigate]);

  const handleToggleNotifPref = async (type, value) => {
    setNotifPrefsError("");
    const previous = notifPrefs;
    setNotifPrefs(prev => ({ ...prev, [type]: value })); // optimistic
    setSavingNotifType(type);
    try {
      await notificationsAPI.updatePreferences({ [type]: value });
    } catch (err) {
      setNotifPrefs(previous); // revert on failure
      setNotifPrefsError(getErrorMessage(err));
    } finally {
      setSavingNotifType(null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name" && formData.useDisplayName) {
      setFormData(prev => ({ ...prev, [name]: value, useDisplayName: false }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

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

    if (formData.useDisplayName && !formData.name.trim()) {
      setMessage({ type: "error", text: "Please enter a display name before enabling 'Show Display Name'." });
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await authAPI.updateProfile({
        firstName: formData.firstName,
        lastName:  formData.lastName,
        location:  formData.location,
        name:      formData.name,
        useDisplayName: formData.useDisplayName,
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

  const handleChangePassword = async () => {
    setPwError("");
    setPwSuccess("");
    if (pwForm.new.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwForm.new !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    setChangingPw(true);
    try {
      await authAPI.changePassword(pwForm.current, pwForm.new);
      setPwForm({ current: "", new: "", confirm: "" });
      // The backend revokes every refresh token for this account on a
      // password change (including this session's), so staying "logged in"
      // here would just be masking a session that's about to fail the next
      // time the access token needs a refresh. Log out immediately instead.
      setPwSuccess("Password updated. Signing you out for security — please log in again.");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("driveclique_user");
      onLogout();
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setPwError(getErrorMessage(err));
    } finally {
      setChangingPw(false);
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
        <div className="glass-card rounded-3xl p-6 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-zinc-800 rounded-xl h-12" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your personal information, security, and account.</p>
      </div>

      {message.text && (
        <div className={`mt-6 p-4 rounded-2xl ${
          message.type === "success"
            ? "bg-green-900/30 border border-green-600"
            : "bg-red-900/30 border border-red-600"
        }`}>
          <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
            {message.text}
          </p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <SettingsSection
          title="Personal Information"
          description="Update your name, username, and where you're based."
        >
          {/* First + Last name */}
          <div className="grid grid-cols-2 gap-4">
            <SettingsField label="First Name" htmlFor="pv-firstName">
              <input
                id="pv-firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder=""
                className={settingsInputClass}
              />
            </SettingsField>
            <SettingsField label="Last Name" htmlFor="pv-lastName">
              <input
                id="pv-lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder=""
                className={settingsInputClass}
              />
            </SettingsField>
          </div>

          {/* Display Name */}
          <SettingsField
            label="Display Name"
            htmlFor="pv-display-name"
            hint="This name will be shown to other users if you enable the option below."
          >
            <input
              id="pv-display-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder=""
              className={settingsInputClass}
            />
          </SettingsField>

          <div className="flex items-center justify-between bg-black border border-zinc-800 rounded-xl p-4">
            <div>
              <div className="text-sm font-medium text-zinc-300">Show Display Name</div>
              <div className="text-xs text-zinc-400 mt-1">
                Use your display name instead of username on Dashboard and member lists
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.useDisplayName}
              onClick={() => setFormData(prev => ({ ...prev, useDisplayName: !prev.useDisplayName }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                formData.useDisplayName ? "bg-red-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.useDisplayName ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Username */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="pv-username" className="text-sm font-medium text-zinc-300">Username</label>
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
                <span className="text-xs text-zinc-400">
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
                  placeholder=""
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus follows the user's own "Change" click, not page load
                  autoFocus
                  className={settingsInputClass}
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
                id="pv-username"
                type="text"
                value={formData.username}
                disabled
                className={settingsInputDisabledClass}
              />
            )}

            <p className="text-xs text-zinc-400 mt-1.5">
              {usernameChangedAt
                ? `Last changed ${new Date(usernameChangedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Can be changed once every 60 days.`
                : "Can be changed once every 60 days."}
            </p>
          </div>

          {/* Email */}
          <SettingsField label="Email" htmlFor="pv-email" hint="Email cannot be changed.">
            <input
              id="pv-email"
              type="email"
              name="email"
              value={formData.email}
              disabled
              className={settingsInputDisabledClass}
            />
          </SettingsField>

          {/* Location */}
          <SettingsField label="Location" hint="Used to suggest nearby clubs.">
            <LocationSearch
              value={formData.location}
              onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
            />
          </SettingsField>
        </SettingsSection>

        {/* Security */}
        <SettingsSection
          title="Security"
          description="Update your password. Choose something you haven't used in the last 5 changes."
        >
          {pwSuccess && (
            <div className="p-3 rounded-xl bg-green-900/30 border border-green-600">
              <p className="text-green-400 text-sm">{pwSuccess}</p>
            </div>
          )}

          <SettingsField label="Current Password">
            <input
              type="password"
              value={pwForm.current}
              onChange={e => { setPwForm(p => ({ ...p, current: e.target.value })); setPwError(""); setPwSuccess(""); }}
              placeholder=""
              className={settingsInputClass}
            />
          </SettingsField>

          <div className="grid grid-cols-2 gap-4">
            <SettingsField
              label="New Password"
              hint="Cannot be the same as any of your last 5 passwords."
            >
              <input
                type="password"
                value={pwForm.new}
                onChange={e => { setPwForm(p => ({ ...p, new: e.target.value })); setPwError(""); setPwSuccess(""); }}
                placeholder=""
                className={settingsInputClass}
              />
            </SettingsField>
            <SettingsField label="Confirm New Password">
              <input
                type="password"
                value={pwForm.confirm}
                onChange={e => { setPwForm(p => ({ ...p, confirm: e.target.value })); setPwError(""); setPwSuccess(""); }}
                placeholder=""
                className={settingsInputClass}
                onKeyDown={e => e.key === "Enter" && !changingPw && handleChangePassword()}
              />
            </SettingsField>
          </div>

          {pwError && <p className="text-red-400 text-sm">{pwError}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPw || !pwForm.current || !pwForm.new || !pwForm.confirm}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock size={15} />
              {changingPw ? "Updating…" : "Update Password"}
            </button>
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          title="Notifications"
          description="Choose which notifications you receive. Turning one off applies going forward — it won't remove your past history."
        >
          {notifPrefsError && <p className="text-red-400 text-sm">{notifPrefsError}</p>}

          <div className="bg-black border border-zinc-800 rounded-xl divide-y divide-zinc-800">
            {NOTIFICATION_PREFERENCE_OPTIONS.map(({ type, label }) => {
              const enabled = notifPrefs[type] !== false;
              return (
                <div key={type} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-zinc-300 pr-4">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={label}
                    disabled={savingNotifType === type}
                    onClick={() => handleToggleNotifPref(type, !enabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      enabled ? "bg-red-600" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection
          title="Danger Zone"
          description="Permanently delete your account and all associated data. This cannot be undone."
        >
          <button
            type="button"
            onClick={() => { setShowDeleteModal(true); setDeletePassword(""); setDeleteError(""); }}
            className="border border-red-600 text-red-500 hover:bg-red-600 hover:text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          >
            Delete Account
          </button>
        </SettingsSection>

        {/* Bottom action bar */}
        <div className="flex justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-xl text-sm font-medium bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all duration-200"
          >
            Go back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 px-8 py-3 rounded-xl font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save settings"}
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
            <p className="text-zinc-400 text-xs mb-5 bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-700/50">
              This action <span className="text-white font-semibold">cannot be undone</span>. Enter your password to confirm.
            </p>

            <div className="mb-4">
              <label htmlFor="delete-account-password" className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <input
                id="delete-account-password"
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteError(""); }}
                placeholder=""
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

const UserSettings = ({ user, onLogout, onUpdateUser }) => {
  const [activeView, setActiveView] = useState("clubs");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <NavBar user={user} onLogout={onLogout} />
      <div className="flex flex-1">
        <AnalyticsSidebar user={user} activeView={activeView} onViewChange={setActiveView} />
        <main id="main-content" className="flex-1 min-w-0 p-6 max-w-5xl mx-auto w-full">
          {activeView === "personal" && <PersonalAnalytics user={user} />}
          {activeView === "clubs"    && <ClubsAnalytics />}
          {activeView === "profile"  && <ProfileView onLogout={onLogout} onUpdateUser={onUpdateUser} />}
        </main>
      </div>
    </div>
  );
};

export default UserSettings;
