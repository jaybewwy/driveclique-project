import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SkeletonCard } from "../components/Skeleton";
import { clubsAPI } from "../services/api";
import { Car, Home, Bell, User, MapPin, Lock, Globe, Users, Calendar, X, Search, Sparkles } from "lucide-react";
import Sidebar from "../components/Sidebar";

const FindClub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setLoading(true);
    const fetchClubs = async () => {
      try {
        const response = await clubsAPI.searchPage(searchQuery.trim() || undefined, page, 20);
        if (response.data.success) {
          setClubs(response.data.clubs);
          setPagination(response.data.pagination);
        }
      } catch (error) {
        console.error("Error fetching clubs:", error);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchClubs, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, page]);

  const isUserMember = (club) => {
    return club.members.some((member) =>
      typeof member === 'string' ? member === user?._id : member._id === user?._id
    );
  };

  const filteredClubs = clubs.filter(club => !club.isPrivate);

  const handleJoinClub = async (clubId, e) => {
    e.stopPropagation();
    setActionError('');
    setActionSuccess('');
    
    try {
      const response = await clubsAPI.requestToJoin(clubId);
      if (response.data.success) {
        if (response.data.clubId) {
          navigate(`/club/${response.data.clubId}`);
        } else {
          setActionSuccess("Join request sent! Awaiting leader approval.");
        }
      }
    } catch (error) {
      console.error("Error joining club:", error);
      setActionError(error.response?.data?.message || "Failed to join club");
    }
  };

  const handleJoinByCode = () => {
    setShowJoinModal(true);
    setInviteCode("");
    setJoinError("");
  };

  const submitJoinByCode = async () => {
    if (!inviteCode.trim()) {
      setJoinError("Please enter an invite code");
      return;
    }
    setJoinLoading(true);
    setJoinError("");
    try {
      const response = await clubsAPI.joinByInviteCode(inviteCode.trim());
      if (response.data.success) {
        const clubId = response.data.clubId || response.data.club?._id;
        if (clubId) {
          navigate(`/club/${clubId}`);
        } else {
          setShowJoinModal(false);
          setActionSuccess("Joined club successfully!");
        }
      }
    } catch (error) {
      console.error("Join by code error:", error);
      setJoinError("Invite code incorrect.");
    } finally {
      setJoinLoading(false);
    }
  };

  const closeModal = () => {
    setShowJoinModal(false);
    setInviteCode("");
    setJoinError("");
  };

  if (showJoinModal) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl" onClick={closeModal}></div>
        <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 rounded-3xl p-8 max-w-md w-full border border-zinc-700/50 shadow-2xl animate-in zoom-in-95 duration-200">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-2 hover:bg-zinc-800 rounded-xl"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join with Invite Code</h2>
            <p className="text-zinc-400 text-sm">
              Enter the exclusive invite code from a club leader
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. HRK707"
                className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-4 text-center text-xl font-mono tracking-widest text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 transition-all"
                autoFocus
              />
            </div>

            {joinError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center">{joinError}</p>
              </div>
            )}

            <button
              onClick={submitJoinByCode}
              disabled={joinLoading}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 py-4 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
            >
              {joinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                "Join Club"
              )}
            </button>
          </div>

          <p className="text-zinc-500 text-xs text-center mt-6">
            Contact a club leader to get your exclusive invite code
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="bg-black/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center cursor-pointer shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all duration-300 hover:scale-105"
            onClick={() => navigate("/dashboard")}
          >
            <Car className="w-5 h-5 text-white" />
          </div>
          <h1 
            className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent cursor-pointer hidden sm:block"
            onClick={() => navigate("/dashboard")}
          >
            DriveClique
          </h1>
        </div>

        <div className="flex-1 max-w-xl mx-4 hidden md:block">
          <div className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clubs by name, location, or description..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-full py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 transition-all duration-300 placeholder-zinc-500"
            />
            <Search className={`absolute left-4 top-3.5 w-5 h-5 transition-colors duration-300 ${searchFocused ? 'text-red-500' : 'text-zinc-500'}`} />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate("/dashboard")} className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition hidden sm:block">
            <Home className="w-5 h-5 text-zinc-400 hover:text-white" />
          </button>
          <button onClick={() => navigate("/my-clubs")} className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition hidden sm:block">
            <Users className="w-5 h-5 text-zinc-400 hover:text-white" />
          </button>
          <button className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition relative">
            <Bell className="w-5 h-5 text-zinc-400 hover:text-white" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          </button>
          <div 
            className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer border-2 border-zinc-700/50 hover:border-red-500/50 transition-all duration-300"
            onClick={() => navigate("/profile")}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
            )}
          </div>
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-red-400 transition hidden sm:block">
            Logout
          </button>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <div className="flex-1 max-w-4xl min-h-screen p-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Find Clubs</h1>
            <p className="text-zinc-400">Discover and join car clubs in your area</p>
          </div>

          {/* Action feedback banners */}
          {actionError && (
            <div className="bg-red-900/30 border border-red-600 rounded-xl p-3 mb-4 flex items-center justify-between">
              <p className="text-red-400 text-sm">{actionError}</p>
              <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-300 ml-3">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {actionSuccess && (
            <div className="bg-green-900/30 border border-green-600 rounded-xl p-3 mb-4 flex items-center justify-between">
              <p className="text-green-400 text-sm">{actionSuccess}</p>
              <button onClick={() => setActionSuccess('')} className="text-green-400 hover:text-green-300 ml-3">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Search */}
          <div className="md:hidden mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-4 pl-12 focus:outline-none focus:border-red-500/50 transition-all"
              />
              <Search className="absolute left-4 top-4 text-zinc-500 w-5 h-5" />
            </div>
          </div>

          {/* Search and Results Count */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs by name..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-4 pl-12 focus:outline-none focus:border-red-500/50 transition-all"
              />
              <Search className="absolute left-4 top-4 text-zinc-500 w-5 h-5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-4 text-zinc-500 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-zinc-400 mt-3 text-sm">
              <span className="text-white font-semibold">{pagination?.total ?? filteredClubs.length}</span> clubs found
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-zinc-800/30">
              <Car className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-zinc-400">No clubs found</h2>
              <p className="text-zinc-500 mt-2">Try a different search term or create your own club</p>
              <button 
                onClick={() => navigate("/create-club")}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-medium"
              >
                Create a Club
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClubs.map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-6 cursor-pointer hover:bg-zinc-900/80 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden ring-2 ring-zinc-800 group-hover:ring-zinc-700 transition-all">
                          {club.avatar ? (
                            <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {club.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold group-hover:text-red-400 transition-colors">{club.name}</h3>
                            {club.isPrivate && (
                              <div className="px-2 py-1 bg-zinc-800 rounded-lg flex items-center gap-1">
                                <Lock className="w-3 h-3 text-zinc-500" />
                                <span className="text-xs text-zinc-500">Private</span>
                              </div>
                            )}
                            {!club.isPrivate && (
                              <div className="px-2 py-1 bg-green-500/10 rounded-lg flex items-center gap-1">
                                <Globe className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-green-500">Public</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-zinc-400 mb-4 line-clamp-2">
                        {club.description || "No description available"}
                      </p>
                      <div className="flex items-center gap-6 text-sm text-zinc-500">
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {club.members.length} members
                        </span>
                        {club.location && (
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {club.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      {isUserMember(club) ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/club/${club._id}`); }}
                          className="bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-2xl font-medium whitespace-nowrap transition-all duration-300"
                        >
                          View Club
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleJoinClub(club._id, e)}
                          className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-6 py-3 rounded-2xl font-medium whitespace-nowrap transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
                        >
                          Join Club
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-zinc-400">
                Page <span className="text-white font-semibold">{page}</span> of <span className="text-white font-semibold">{pagination.totalPages}</span>
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasMore}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="w-80 hidden xl:block p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-red-500" />
            Popular Clubs
          </h3>
          <div className="space-y-3">
            {filteredClubs
              .sort((a, b) => b.members.length - a.members.length)
              .slice(0, 5)
              .map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl hover:bg-zinc-900/50 transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden ring-1 ring-zinc-700/30">
                    {club.avatar ? (
                      <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {club.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-white transition-colors truncate">{club.name}</p>
                    <p className="text-xs text-zinc-500">{club.members.length} members</p>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-6">
            <button
              onClick={handleJoinByCode}
              className="w-full bg-zinc-800/50 hover:bg-zinc-800 px-6 py-3 rounded-2xl flex items-center justify-center gap-2 font-medium transition-all duration-300 border border-zinc-700/50 hover:border-zinc-600/50"
            >
              <Lock size={18} />
              Join with Code
            </button>
          </div>

          <div className="mt-8 p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-2xl border border-red-500/20">
            <h3 className="font-semibold mb-2 text-sm">Why Join a Club?</h3>
            <ul className="text-xs text-zinc-400 space-y-2">
              <li className="flex items-start gap-2">
                <Users className="w-3 h-3 mt-0.5 text-red-400" />
                Connect with enthusiasts
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="w-3 h-3 mt-0.5 text-red-400" />
                Exclusive events & drives
              </li>
              <li className="flex items-start gap-2">
                <Car className="w-3 h-3 mt-0.5 text-red-400" />
                Share knowledge & tips
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindClub;