import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Users, Plus, Crown, Lock, X, TrendingUp } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";

const MyClubs = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Sort clubs to prioritize clubs where the user is the leader
  const sortedClubs = [...clubs].sort((a, b) => {
    const aIsLeader = a.leader._id === user?._id || a.leader === user?._id;
    const bIsLeader = b.leader._id === user?._id || b.leader === user?._id;
    
    if (aIsLeader && !bIsLeader) return -1;
    if (!aIsLeader && bIsLeader) return 1;
    return 0;
  });

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://localhost:5000/api/clubs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
          setClubs(response.data.clubs);
        }
      } catch (error) {
        console.error("Error fetching clubs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClubs();
  }, []);

  const submitJoinByCode = async () => {
    if (!inviteCode.trim()) {
      setJoinError("Please enter an invite code");
      return;
    }
    setJoinLoading(true);
    setJoinError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/api/clubs/join-by-code/${inviteCode.trim()}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        setShowJoinModal(false);
        alert("Joined club successfully!");
        window.location.reload();
      }
    } catch (error) {
      setJoinError(error.response?.data?.message || "Invalid invite code");
    } finally {
      setJoinLoading(false);
    }
  };

  const closeModal = () => {
    setShowJoinModal(false);
    setInviteCode("");
    setJoinError("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading clubs...</p>
      </div>
    );
  }

  // Join with Code Modal
  if (showJoinModal) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal}></div>
        <div className="relative bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
          >
            <X size={24} />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join with Invite Code</h2>
            <p className="text-zinc-400 text-sm">
              Enter the invite code from a club leader to join a private club.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="invite-code-input" className="block text-sm font-medium text-zinc-300 mb-2">
                Invite Code
              </label>
              <input
                id="invite-code-input"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. HRK707"
                className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                autoFocus
              />
            </div>

            {joinError && (
              <div className="bg-red-900/30 border border-red-600 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center">{joinError}</p>
              </div>
            )}

            <button
              onClick={submitJoinByCode}
              disabled={joinLoading}
              className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joinLoading ? "Joining..." : "Join Club"}
            </button>
          </div>

          <p className="text-zinc-500 text-xs text-center mt-4">
            Contact the club leader to get an invite code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <div className="flex-1 max-w-4xl min-h-screen p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">My Clubs</h1>
            <div className="flex gap-4">
              <button
                onClick={() => navigate("/create-club")}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl flex items-center gap-2 font-medium"
              >
                <Plus size={20} /> Create New Club
              </button>
            </div>
          </div>

          {clubs.length === 0 ? (
            <div className="bg-zinc-900 rounded-3xl p-12 text-center">
              <Users className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Clubs Yet</h2>
              <p className="text-zinc-400 mb-6">
                You haven't joined or created any clubs yet.
              </p>
              <button
                onClick={() => navigate("/create-club")}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl font-medium inline-flex items-center gap-2"
              >
                <Plus size={20} /> Create Your First Club
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedClubs.map((club) => {
                const isLeader = club.leader._id === user?._id || club.leader === user?._id;
                return (
                  <div
                    key={club._id}
                    className="bg-zinc-900 rounded-3xl p-6 flex flex-col border border-zinc-800"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border-2 border-zinc-700">
                          {club.avatar ? (
                            <img
                              src={club.avatar}
                              alt={club.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/48?text=Club';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-orange-600">
                              <span className="text-white font-bold">
                                {club.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold">{club.name}</h3>
                          {isLeader && (
                            <div className="flex items-center gap-1 text-amber-500 text-sm mt-1">
                              <Crown size={14} /> Leader
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-500">
                          {club.members.length}
                        </div>
                        <div className="text-xs text-zinc-500">members</div>
                      </div>
                    </div>

                    <p className="text-zinc-400 text-sm mb-6 flex-1">
                      {club.description}
                    </p>

                    <button
                      onClick={() => navigate(`/club/${club._id}`)}
                      className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
                    >
                      View Club
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-80 hidden 2xl:block p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
          {/* Your Clubs */}
          <div className="mb-6">
            <h3 className="font-semibold mb-4">Your Clubs</h3>
            {clubs.length === 0 ? (
              <p className="text-zinc-500 text-sm">No clubs yet</p>
            ) : (
              <div className="space-y-3">
            {sortedClubs.map((club) => {
                  const isLeader = club.leader._id === user?._id || club.leader === user?._id;
                  return (
                    <div 
                      key={club._id} 
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900/50 transition cursor-pointer"
                      onClick={() => navigate(`/club/${club._id}`)}
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700">
                        {club.avatar ? (
                          <img
                            src={club.avatar}
                            alt={club.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/40?text=Club';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-orange-600">
                            <span className="text-white text-xs font-bold">
                              {club.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-medium truncate">{club.name}</p>
                          {isLeader && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {club.members.length} members
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="p-4 bg-gradient-to-br from-zinc-900/50 to-zinc-900/20 rounded-2xl border border-zinc-800/30 mt-auto">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-zinc-800/30 rounded-lg">
                <p className="text-lg font-bold text-white">{clubs.length}</p>
                <p className="text-xs text-zinc-500">Clubs</p>
              </div>
              <div className="p-2 bg-zinc-800/30 rounded-lg">
                <p className="text-lg font-bold text-white">12</p>
                <p className="text-xs text-zinc-500">Events</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyClubs;