import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Car, Calendar, MapPin, Users, TrendingUp, ArrowRight,
  Sparkles, Zap, Shield, Globe, Mail, CheckCircle, BarChart2, Plus
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import { clubsAPI, drivesAPI, authAPI } from "../services/api";
import { SkeletonCard } from "../components/Skeleton";
import { useAuth } from "../hooks/useAuth";
import { useClubs } from "../hooks/useClubs";

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  useAuth();
  const { clubs: userClubs } = useClubs();

  const userId = user?._id?.toString() || user?.id?.toString() || "";
  const isLeader = userClubs.some(club => {
    const leaderId = club.leader?._id?.toString() || club.leader?.toString();
    return leaderId && userId && leaderId === userId;
  });

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent]       = useState(false);
  const [showWelcome, setShowWelcome]     = useState(false);
  const [upcomingDrives, setUpcomingDrives] = useState([]);
  const [trendingClub, setTrendingClub]   = useState(null);
  const [drivesLoading, setDrivesLoading] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem('justLoggedIn')) {
      setShowWelcome(true);
      sessionStorage.removeItem('justLoggedIn');
    }
  }, []);

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await authAPI.resendVerification();
      setResendSent(true);
    } catch {
      // Silently fail
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendingResponse, clubsResponse] = await Promise.all([
          clubsAPI.getTopClub(),
          clubsAPI.getAll(),
        ]);

        if (trendingResponse.data.success) setTrendingClub(trendingResponse.data.club);

        if (clubsResponse.data.success) {
          const clubs = clubsResponse.data.clubs || [];
          const drivesResults = await Promise.all(clubs.map(c => drivesAPI.getClubDrives(c._id)));

          let allDrives = [];
          drivesResults.forEach(response => {
            if (response.data.success && response.data.drives) {
              response.data.drives.forEach(drive => {
                allDrives.push({
                  ...drive,
                  clubName: drive.club?.name || 'Unknown Club',
                  clubId:   drive.club?._id || null,
                });
              });
            }
          });

          const upcoming = allDrives
            .filter(d => !d.isCancelled && !d.isCompleted && new Date(d.date) >= new Date())
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 10);

          const drivesWithRSVPs = await Promise.all(
            upcoming.map(async (drive) => {
              try {
                const r = await drivesAPI.getRSVPStatus(drive._id);
                if (r.data.success) return { ...drive, attendees: r.data.counts?.going || 0 };
              } catch { /* default 0 */ }
              return { ...drive, attendees: 0 };
            })
          );

          setUpcomingDrives(drivesWithRSVPs);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setDrivesLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const quickActions = [
    {
      icon: Zap, label: "Quick Actions",
      desc: "Create drives, invite members, manage your club",
      from: "from-amber-500/15", to: "to-orange-500/10", iconCls: "text-amber-400",
    },
    {
      icon: Shield, label: "Club Privacy",
      desc: "Control who joins with invite codes",
      from: "from-emerald-500/15", to: "to-teal-500/10", iconCls: "text-emerald-400",
    },
    {
      icon: Globe, label: "Discover",
      desc: "Find car clubs near your location",
      from: "from-sky-500/15", to: "to-blue-500/10", iconCls: "text-sky-400",
    },
  ];

  const displayName =
    user?.firstName
      ? user.firstName
      : user?.name?.split(' ')[0] || user?.username || 'Driver';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* ── Main feed ────────────────────────────────────────────────── */}
        <div className="flex-1 max-w-3xl min-h-screen p-5 md:p-6">

          {/* Email verification banner */}
          {user?.emailVerified === false && (
            <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">Verify your email address</p>
                  <p className="text-amber-400/60 text-xs mt-0.5">Required for drive reminders and club notifications.</p>
                </div>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendSent}
                className="text-xs font-semibold whitespace-nowrap text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {resendSent
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Sent!</>
                  : resendLoading ? 'Sending…' : 'Resend email →'}
              </button>
            </div>
          )}

          {/* Welcome heading */}
          {showWelcome && (
            <div className="mb-7 animate-fade-slide-up">
              <p className="section-label mb-2">Good to see you</p>
              <h2 className="text-3xl font-bold tracking-tight">
                Welcome back,{' '}
                <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  {displayName}
                </span>
              </h2>
              <p className="text-zinc-500 text-sm mt-1.5">Here's what's happening in your car community</p>
            </div>
          )}

          {/* Quick action chips */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {quickActions.map(({ icon: Icon, label, desc, from, to, iconCls }) => (
              <div
                key={label}
                className={`relative overflow-hidden p-4 bg-gradient-to-br ${from} ${to} rounded-2xl border border-white/[0.06] hover:border-white/[0.11] transition-all duration-200 cursor-pointer group hover:-translate-y-0.5`}
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.03] rounded-full blur-xl" />
                <Icon className={`w-5 h-5 ${iconCls} mb-2.5`} />
                <p className="font-semibold text-xs text-white">{label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug hidden sm:block">{desc}</p>
              </div>
            ))}
          </div>

          {/* Analytics CTA — leaders only */}
          {isLeader && (
            <button
              onClick={() => navigate("/settings")}
              className="w-full flex items-center justify-between glass-card px-5 py-3.5 mb-4 hover:border-red-500/20 hover:bg-white/[0.06] transition-all duration-200 group rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500/20 to-orange-500/20 group-hover:from-red-500/30 group-hover:to-orange-500/30 rounded-xl flex items-center justify-center transition-all duration-200">
                  <BarChart2 className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Club Analytics</p>
                  <p className="text-[11px] text-zinc-500">Performance insights for your clubs</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all duration-200" />
            </button>
          )}

          {/* Create drive card */}
          <div className="relative overflow-hidden glass-card p-5 mb-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500/8 to-orange-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-white">Plan Your Next Event</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Organize drives and connect with enthusiasts</p>
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 bg-white/[0.06] rounded-full flex-shrink-0 self-center" />
                <input
                  type="text"
                  placeholder="What's the plan?"
                  className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/15 transition-all duration-200 placeholder-zinc-600 text-white"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => navigate("/my-clubs")}
                  className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Drive
                </button>
                <button
                  onClick={() => navigate("/find-club")}
                  className="px-5 py-2.5 btn-ghost text-sm"
                >
                  Find Clubs
                </button>
              </div>
            </div>
          </div>

          {/* Upcoming drives */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-label mb-0.5">Schedule</p>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-red-500" />
                  Upcoming Drives
                </h3>
              </div>
              <button
                onClick={() => navigate("/my-clubs")}
                className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {drivesLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}

              {!drivesLoading && upcomingDrives.map((drive) => (
                <div
                  key={drive._id}
                  onClick={() => drive.clubId && navigate(`/club/${drive.clubId}`)}
                  className="glass-card p-4 hover:border-white/[0.12] hover:-translate-y-0.5 cursor-pointer group transition-all duration-200 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white group-hover:text-red-400 transition-colors truncate mb-1.5">
                        {drive.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(drive.date)}
                        </span>
                        {drive.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[140px]">{drive.location}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {drive.attendees} going
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-white/[0.04] group-hover:bg-red-500/15 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-red-400" />
                    </div>
                  </div>
                </div>
              ))}

              {!drivesLoading && upcomingDrives.length === 0 && (
                <div className="text-center py-10 glass-subtle rounded-2xl">
                  <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-2.5" />
                  <p className="text-sm text-zinc-500 font-medium">No upcoming drives</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Join a club and RSVP to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────── */}
        <div className="w-72 hidden 2xl:flex flex-col p-5 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto gap-4">

          {/* Trending club */}
          <div>
            <p className="section-label mb-3">Trending</p>
            {trendingClub ? (
              <div
                onClick={() => navigate(`/club/${trendingClub._id}`)}
                className="glass-card p-4 cursor-pointer hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200 group rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-white/[0.08] shrink-0">
                    {trendingClub.avatar ? (
                      <img src={trendingClub.avatar} alt={trendingClub.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">{trendingClub.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-white group-hover:text-red-400 transition-colors">
                      {trendingClub.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {trendingClub.memberCount} members · {trendingClub.completedDrivesCount} drives
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-red-500 shrink-0" />
                </div>
              </div>
            ) : (
              <div className="glass-subtle p-4 text-center rounded-2xl">
                <TrendingUp className="w-7 h-7 text-zinc-700 mx-auto mb-1.5" />
                <p className="text-xs text-zinc-600">No trending clubs yet</p>
              </div>
            )}
          </div>

          {/* Tip card */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/8 border border-red-500/15">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="relative flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white mb-1">Pro Tip</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Create a drive to engage your club members and build a stronger community!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
