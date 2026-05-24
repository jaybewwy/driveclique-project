import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Users, Calendar, Home, Search, Bell, Plus, Crown, Copy, Lock, X, Check } from "lucide-react";

const MyClubs = ({ onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

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

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Invite Code
              </label>
              <input
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
      <nav className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">DriveClique</h1>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search clubs, drives, or members..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-3 pl-12 text-sm focus:outline-none focus:border-red-600"
            />
            <Search className="absolute left-4 top-3.5 text-zinc-500 w-5 h-5" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-3 hover:bg-zinc-900 rounded-full"
          >
            <Home className="w-6 h-6" />
          </button>
          <button className="p-3 hover:bg-zinc-900 rounded-full">
            <Users className="w-6 h-6" />
          </button>
          <button className="p-3 hover:bg-zinc-900 rounded-full relative">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
              3
            </span>
          </button>
          <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden cursor-pointer">
            <img src="https://i.pravatar.cc/128?u=alex" alt="Profile" />
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-zinc-400 hover:text-red-500"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        <div className="w-72 hidden lg:block border-r border-zinc-800 p-4 sticky top-16 h-screen overflow-y-auto">
          <div className="space-y-2">
            <div
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer"
            >
              <Home className="w-6 h-6" />
              <span className="font-medium">Home</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer bg-zinc-900">
              <Users className="w-6 h-6 text-red-500" />
              <span className="font-medium">My Clubs</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer">
              <Calendar className="w-6 h-6" />
              <span>Upcoming Drives</span>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-4xl min-h-screen p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">My Clubs</h1>
            <div className="flex gap-4">
              <button
                onClick={handleJoinByCode}
                className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl flex items-center gap-2 font-medium"
              >
                <Lock size={20} /> Join with Code
              </button>
              <button
                onClick={() => navigate("/browse-clubs")}
                className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl flex items-center gap-2 font-medium"
              >
                <Search size={20} /> Browse Clubs
              </button>
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
              {clubs.map((club) => {
                const currentUser = JSON.parse(localStorage.getItem("driveclique_user") || "{}");
                const isLeader = club.leader._id === currentUser._id;
                return (
                  <div
                    key={club._id}
                    className="bg-zinc-900 rounded-3xl p-6 flex flex-col border border-zinc-800"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{club.name}</h3>
                        {isLeader && (
                          <div className="flex items-center gap-1 text-amber-500 text-sm mt-1">
                            <Crown size={14} /> Leader
                          </div>
                        )}
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

                    <div className="bg-zinc-800 rounded-2xl p-3 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Invite Code</span>
                        {copiedCode === club.inviteCode && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check size={12} /> Copied!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between bg-black rounded-xl px-3 py-2 mt-1">
                        <span className="font-mono text-sm tracking-widest">
                          {club.inviteCode}
                        </span>
                        <button
                          onClick={() => copyInviteCode(club.inviteCode)}
                          className="text-red-500 hover:text-red-400 transition"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

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

        <div className="w-80 hidden xl:block p-6 sticky top-16 h-screen overflow-y-auto">
          <h3 className="font-semibold mb-4">Your Clubs</h3>
          {clubs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No clubs yet</p>
          ) : (
            <div className="space-y-4">
              {clubs.map((club) => (
                <div key={club._id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl"></div>
                  <div>
                    <p className="font-medium">{club.name}</p>
                    <p className="text-xs text-zinc-500">
                      {club.members.length} members
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyClubs;