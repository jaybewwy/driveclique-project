import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Calendar, MapPin, Users, TrendingUp, ArrowRight, Sparkles, Zap, Shield, Globe, Mail, CheckCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import { clubsAPI, drivesAPI, authAPI } from "../services/api";
import { SkeletonCard } from "../components/Skeleton";
import { useAuth } from "../hooks/useAuth";

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await authAPI.resendVerification();
      setResendSent(true);
    } catch {
      // Silently fail — user can try again
    } finally {
      setResendLoading(false);
    }
  };
  const [upcomingDrives, setUpcomingDrives] = useState([]);
  const [trendingClub, setTrendingClub] = useState(null);
  const [drivesLoading, setDrivesLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendingResponse, clubsResponse] = await Promise.all([
          clubsAPI.getTopClub(),
          clubsAPI.getAll(),
        ]);

        if (trendingResponse.data.success) {
          setTrendingClub(trendingResponse.data.club);
        }

        if (clubsResponse.data.success) {
          const clubs = clubsResponse.data.clubs || [];

          const drivesResults = await Promise.all(
            clubs.map(club => drivesAPI.getClubDrives(club._id))
          );

          let allDrives = [];
          drivesResults.forEach(response => {
            if (response.data.success && response.data.drives) {
              response.data.drives.forEach(drive => {
                allDrives.push({
                  ...drive,
                  clubName: drive.club?.name || 'Unknown Club',
                  clubId: drive.club?._id || null,
                });
              });
            }
          });

          const upcoming = allDrives
            .filter(drive => !drive.isCancelled && !drive.isCompleted && new Date(drive.date) >= new Date())
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 10);

          const drivesWithRSVPs = await Promise.all(
            upcoming.map(async (drive) => {
              try {
                const rsvpResponse = await drivesAPI.getAttendees(drive._id);
                if (rsvpResponse.data.success) {
                  return { ...drive, attendees: rsvpResponse.data.stats.going || 0 };
                }
              } catch {
                // default to 0 if unavailable
              }
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
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const features = [
    {
      icon: Zap,
      title: "Quick Actions",
      description: "Create drives, invite members, and manage your club",
      color: "from-yellow-500/20 to-orange-500/20",
      iconColor: "text-yellow-500",
    },
    {
      icon: Shield,
      title: "Club Security",
      description: "Control who joins your club with privacy settings",
      color: "from-green-500/20 to-emerald-500/20",
      iconColor: "text-green-500",
    },
    {
      icon: Globe,
      title: "Discover Clubs",
      description: "Find and join car clubs in your area",
      color: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-500",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main Feed */}
        <div className="flex-1 max-w-3xl min-h-screen p-6">

          {/* Email verification banner — only shown when emailVerified is explicitly false */}
          {user?.emailVerified === false && (
            <div className="bg-amber-900/20 border border-amber-500/40 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">Verify your email address</p>
                  <p className="text-amber-400/70 text-xs mt-0.5">Verify to receive drive reminders and club notifications.</p>
                </div>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendSent}
                className="flex items-center gap-2 text-sm font-medium whitespace-nowrap transition disabled:opacity-60 text-amber-400 hover:text-amber-300"
              >
                {resendSent
                  ? <><CheckCircle className="w-4 h-4" /> Sent!</>
                  : resendLoading ? 'Sending…' : 'Resend email'}
              </button>
            </div>
          )}

          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">
              Welcome back, <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">{user?.name || user?.username || 'Driver'}</span>
            </h2>
            <p className="text-zinc-400">Here's what's happening in your car community</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className={`relative overflow-hidden p-4 bg-gradient-to-br ${feature.color} rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group cursor-pointer`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <Icon className={`w-8 h-8 ${feature.iconColor} mb-3`} />
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-zinc-400">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* Create Drive Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 backdrop-blur-sm rounded-3xl p-6 mb-8 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Plan Your Next Event</h3>
                  <p className="text-sm text-zinc-400">Organize events and connect with fellow enthusiasts</p>
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="w-10 h-10 bg-zinc-800/50 rounded-full flex-shrink-0"></div>
                <input 
                  type="text" 
                  placeholder="What's the plan?" 
                  className="flex-1 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 transition-all duration-300 placeholder-zinc-500"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => navigate("/my-clubs")}
                  className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 py-3 rounded-2xl font-medium transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02]"
                >
                  Create Drive
                </button>
                <button 
                  onClick={() => navigate("/find-club")}
                  className="px-6 py-3 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-2xl font-medium transition-all duration-300 border border-zinc-700/50 hover:border-zinc-600/50"
                >
                  Find Clubs
                </button>
              </div>
            </div>
          </div>

          {/* Upcoming Drives */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-500" />
                Upcoming Drives
              </h3>
              <button 
                onClick={() => navigate("/my-clubs")}
                className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {drivesLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              {!drivesLoading && upcomingDrives.map((drive) => (
                <div
                  key={drive._id}
                  onClick={() => drive.clubId ? navigate(`/club/${drive.clubId}`) : null}
                  className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2 group-hover:text-red-400 transition-colors">
                        {drive.name}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(drive.date)}
                        </span>
                        {drive.time && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" strokeWidth="2" />
                              <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                            </svg>
                            {drive.time}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {drive.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {drive.attendees}
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ArrowRight className="w-5 h-5 text-red-500" />
                    </div>
                  </div>
                </div>
              ))}

              {!drivesLoading && upcomingDrives.length === 0 && (
                <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-zinc-800/30">
                  <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">No upcoming drives</p>
                  <p className="text-sm text-zinc-600 mt-1">Create one to get started!</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="w-80 hidden 2xl:block p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
          {/* Trending Club */}
          <div className="mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-500" />
              Trending Club
            </h3>
            {trendingClub ? (
              <div
                onClick={() => navigate(`/club/${trendingClub._id}`)}
                className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl hover:bg-zinc-900/50 transition cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-zinc-700/30 flex-shrink-0">
                  {trendingClub.avatar ? (
                    <img src={trendingClub.avatar} alt={trendingClub.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {trendingClub.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm group-hover:text-white transition-colors truncate">
                    {trendingClub.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{trendingClub.memberCount} members</span>
                    <span>•</span>
                    <span>{trendingClub.completedDrivesCount} drives</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-red-500 transition-colors" />
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-900/30 rounded-xl border border-zinc-800/30">
                <TrendingUp className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No trending clubs yet</p>
              </div>
            )}
          </div>

          {/* Pro Tip */}
          <div className="relative overflow-hidden p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-2xl border border-red-500/20 mt-auto">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold">Pro Tip</span>
              </div>
              <p className="text-xs text-zinc-300">
                Create a drive to engage your club members and build a stronger community!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;