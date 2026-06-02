import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SkeletonCard } from "../components/Skeleton";
import { clubsAPI } from "../services/api";
import { Car, MapPin, Lock, Globe, Users, Calendar, X, Search, Sparkles, ArrowRight, Flag } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import ReportModal from "../components/ui/ReportModal";

const FindClub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [popularClubs, setPopularClubs] = useState([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [page, setPage]                 = useState(1);
  const [pagination, setPagination]     = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode]     = useState("");
  const [joinError, setJoinError]       = useState("");
  const [joinLoading, setJoinLoading]   = useState(false);
  const [actionError, setActionError]   = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [reportTarget, setReportTarget] = useState(null);

  useEffect(() => {
    clubsAPI.searchPage(undefined, 1, 50)
      .then(res => {
        if (res.data.success) {
          setPopularClubs(
            [...res.data.clubs].sort((a, b) => b.members.length - a.members.length).slice(0, 5)
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [searchQuery]);

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

  const isUserMember = (club) =>
    club.members.some(m => typeof m === 'string' ? m === user?._id : m._id === user?._id);

  const filteredClubs = clubs.filter(c => !c.isPrivate);

  const handleJoinClub = async (clubId, e) => {
    e.stopPropagation();
    setActionError('');
    setActionSuccess('');
    try {
      const response = await clubsAPI.requestToJoin(clubId);
      if (response.data.success) {
        if (response.data.clubId) navigate(`/club/${response.data.clubId}`);
        else setActionSuccess("Join request sent! Awaiting leader approval.");
      }
    } catch (error) {
      setActionError(error.response?.data?.message || "Failed to join club");
    }
  };

  const handleJoinByCode = () => { setShowJoinModal(true); setInviteCode(""); setJoinError(""); };

  const submitJoinByCode = async () => {
    if (!inviteCode.trim()) { setJoinError("Please enter an invite code"); return; }
    setJoinLoading(true);
    setJoinError("");
    try {
      const response = await clubsAPI.joinByInviteCode(inviteCode.trim());
      if (response.data.success) {
        const clubId = response.data.clubId || response.data.club?._id;
        if (clubId) navigate(`/club/${clubId}`);
        else { setShowJoinModal(false); setActionSuccess("Joined club successfully!"); }
      }
    } catch {
      setJoinError("Invite code incorrect.");
    } finally {
      setJoinLoading(false);
    }
  };

  const closeModal = () => { setShowJoinModal(false); setInviteCode(""); setJoinError(""); };

  /* ── Invite-code modal ────────────────────────────────────────────────── */
  if (showJoinModal) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl" onClick={closeModal} />
        <div className="relative glass-card p-8 max-w-sm w-full animate-fade-slide-up rounded-3xl">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.07] rounded-lg transition-all"
          >
            <X size={16} />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Join with Invite Code</h2>
            <p className="text-zinc-500 text-sm">Enter the code from a club leader</p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. HRK707"
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
              autoFocus
            />

            {joinError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center">{joinError}</p>
              </div>
            )}

            <button
              onClick={submitJoinByCode}
              disabled={joinLoading}
              className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"
            >
              {joinLoading ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Joining…</>
              ) : "Join Club"}
            </button>
          </div>

          <p className="text-zinc-600 text-xs text-center mt-5">
            Contact a club leader to get your invite code
          </p>
        </div>
      </div>
    );
  }

  /* ── Main page ────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} showSearch={false} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main content */}
        <div className="flex-1 max-w-4xl min-h-screen p-5 md:p-6">

          {/* Page header */}
          <div className="mb-6">
            <p className="section-label mb-1.5">Discovery</p>
            <h1 className="text-2xl font-bold text-white">Find Clubs</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Discover and join car clubs near you</p>
          </div>

          {/* Feedback banners */}
          {actionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
              <p className="text-red-400 text-sm">{actionError}</p>
              <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-300 shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}
          {actionSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
              <p className="text-green-400 text-sm">{actionSuccess}</p>
              <button onClick={() => setActionSuccess('')} className="text-green-400 hover:text-green-300 shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Search bar */}
          <div className="mb-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by club name or location…"
                className="w-full h-11 bg-white/[0.06] border border-white/[0.08] rounded-2xl pl-11 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/15 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-zinc-600 text-xs mt-2 pl-1">
              <span className="text-zinc-400 font-medium">{pagination?.total ?? filteredClubs.length}</span> clubs found
            </p>
          </div>

          {/* Results */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-16 glass-subtle rounded-3xl">
              <Car className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-base font-semibold text-zinc-400">No clubs found</p>
              <p className="text-sm text-zinc-600 mt-1 mb-5">Try a different search or create your own</p>
              <button
                onClick={() => navigate("/create-club")}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                Create a Club
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClubs.map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="glass-card p-5 cursor-pointer hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200 group rounded-3xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Club avatar */}
                      <div className="w-11 h-11 rounded-xl shrink-0 overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-red-500/20 transition-all">
                        {club.avatar ? (
                          <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                            <span className="text-white font-bold">{club.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name + badge row */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                            {club.name}
                          </h3>
                          {club.isPrivate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-[10px] text-zinc-500">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] text-green-500">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-zinc-500 line-clamp-1 mb-2">
                          {club.description || "No description"}
                        </p>

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {club.members.length} members
                          </span>
                          {club.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[160px]">{club.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CTA + report */}
                    <div className="shrink-0 self-center flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setReportTarget({ type: 'club', id: club._id, name: club.name }); }}
                        className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
                        title="Report club"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                      {isUserMember(club) ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/club/${club._id}`); }}
                          className="btn-ghost px-4 py-2 text-xs font-medium flex items-center gap-1.5"
                        >
                          View <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleJoinClub(club._id, e)}
                          className="btn-primary px-4 py-2 text-xs font-medium"
                        >
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-xs text-zinc-500">
                <span className="text-white font-medium">{page}</span> / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasMore}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-72 hidden xl:flex flex-col p-5 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto gap-5">

          {/* Popular clubs */}
          <div>
            <p className="section-label mb-3">Popular</p>
            <div className="space-y-2">
              {popularClubs.map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/[0.05] group transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden ring-1 ring-white/[0.08]">
                    {club.avatar ? (
                      <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">{club.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors truncate">{club.name}</p>
                    <p className="text-[11px] text-zinc-600">{club.members.length} members</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Join by code */}
          <button
            onClick={handleJoinByCode}
            className="w-full btn-ghost px-4 py-3 text-sm flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Join with Code
          </button>

          {/* Why join card */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-red-500/8 to-orange-500/6 border border-red-500/15">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-white">Why join a club?</p>
            </div>
            <ul className="space-y-1.5">
              {[
                { icon: Users,    text: "Connect with enthusiasts" },
                { icon: Calendar, text: "Access exclusive drives" },
                { icon: Car,      text: "Share knowledge & tips" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Icon className="w-3 h-3 text-red-400 shrink-0" /> {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Report modal */}
      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};

export default FindClub;
