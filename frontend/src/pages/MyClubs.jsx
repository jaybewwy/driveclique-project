import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clubsAPI } from "../services/api";
import { useClubs } from "../hooks/useClubs";
import { Users, Plus, Crown, Lock, X, TrendingUp, ArrowRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import { SkeletonClubCard } from "../components/Skeleton";

const MyClubs = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { clubs, isLoading: loading, refreshClubs } = useClubs();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode]       = useState("");
  const [joinError, setJoinError]         = useState("");
  const [joinLoading, setJoinLoading]     = useState(false);

  const sortedClubs = [...clubs].sort((a, b) => {
    const aL = a.leader?._id === user?._id || a.leader === user?._id;
    const bL = b.leader?._id === user?._id || b.leader === user?._id;
    return aL === bL ? 0 : aL ? -1 : 1;
  });

  const submitJoinByCode = async () => {
    if (!inviteCode.trim()) { setJoinError("Please enter an invite code"); return; }
    setJoinLoading(true);
    setJoinError("");
    try {
      const response = await clubsAPI.joinByInviteCode(inviteCode.trim());
      if (response.data.success) {
        await refreshClubs();
        setShowJoinModal(false);
        setInviteCode("");
      }
    } catch (error) {
      setJoinError(error.response?.data?.message || "Invalid invite code");
    } finally {
      setJoinLoading(false);
    }
  };

  const closeModal = () => { setShowJoinModal(false); setInviteCode(""); setJoinError(""); };

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <NavBar user={user} onLogout={onLogout} />
        <div className="flex max-w-7xl mx-auto">
          <Sidebar user={user} />
          <div className="flex-1 p-6">
            <div className="mb-6">
              <p className="section-label mb-1">My Garage</p>
              <h1 className="text-2xl font-bold">My Clubs</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonClubCard key={i} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Invite-code modal ──────────────────────────────────────────────── */
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
              id="invite-code-input"
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
            Contact the club leader to get an invite code
          </p>
        </div>
      </div>
    );
  }

  /* ── Main page ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main content */}
        <div className="flex-1 max-w-4xl min-h-screen p-5 md:p-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="section-label mb-1.5">My Garage</p>
              <h1 className="text-2xl font-bold text-white">My Clubs</h1>
            </div>
            <button
              onClick={() => navigate("/create-club")}
              className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Club
            </button>
          </div>

          {/* Empty state */}
          {clubs.length === 0 ? (
            <div className="glass-card py-16 text-center rounded-3xl">
              <div className="w-16 h-16 bg-white/[0.04] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-zinc-600" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">No clubs yet</h2>
              <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">
                You haven't joined or created any clubs. Start your journey!
              </p>
              <button
                onClick={() => navigate("/create-club")}
                className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Your First Club
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedClubs.map((club) => {
                const isLeader = club.leader?._id === user?._id || club.leader === user?._id;
                return (
                  <div
                    key={club._id}
                    className="glass-card p-5 flex flex-col hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200 group rounded-3xl"
                  >
                    {/* Club header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-red-500/20 transition-all shrink-0">
                          {club.avatar ? (
                            <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                              <span className="text-white font-bold">{club.name.charAt(0)}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-sm leading-tight">{club.name}</h3>
                          {isLeader && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 mt-0.5">
                              <Crown className="w-3 h-3" /> Leader
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-white">{club.members.length}</p>
                        <p className="text-[11px] text-zinc-600">members</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-zinc-500 mb-4 flex-1 line-clamp-2 leading-relaxed">
                      {club.description || "No description provided."}
                    </p>

                    {/* CTA */}
                    <button
                      onClick={() => navigate(`/club/${club._id}`)}
                      className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                      View Club <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-72 hidden 2xl:flex flex-col p-5 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto gap-4">

          {/* Clubs list */}
          <div>
            <p className="section-label mb-3">Your Clubs</p>
            {clubs.length === 0 ? (
              <p className="text-zinc-600 text-xs">No clubs yet</p>
            ) : (
              <div className="space-y-1.5">
                {sortedClubs.map((club) => {
                  const isLeader = club.leader?._id === user?._id || club.leader === user?._id;
                  return (
                    <button
                      key={club._id}
                      onClick={() => navigate(`/club/${club._id}`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.05] group transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/[0.07] shrink-0">
                        {club.avatar ? (
                          <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{club.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors truncate">{club.name}</p>
                          {isLeader && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-zinc-600">{club.members.length} members</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="glass-subtle p-4 rounded-2xl mt-auto">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
              <p className="section-label">Quick Stats</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-xl">
                <p className="text-xs text-zinc-500">Clubs Joined</p>
                <p className="text-sm font-bold text-white">{clubs.length}</p>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-xl">
                <p className="text-xs text-zinc-500">Total Members</p>
                <p className="text-sm font-bold text-white">
                  {clubs.reduce((s, c) => s + (c.members?.length || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyClubs;
