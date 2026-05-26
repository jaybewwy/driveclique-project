import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Home, Bell, User, MapPin, Lock, Globe, Users, Calendar, X } from "lucide-react";
import Sidebar from "../components/Sidebar";

const FindClub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const token = localStorage.getItem("token");
        // Use the browse endpoint to get all public clubs
        const response = await axios.get("http://localhost:5000/api/clubs/browse", {
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

  // Filter clubs to only show public clubs, then filter by search query
  const publicClubs = clubs.filter(club => !club.isPrivate);
  const filteredClubs = searchQuery.trim()
    ? publicClubs.filter(club =>
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (club.description && club.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (club.location && club.location.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : publicClubs;

  const handleJoinClub = async (clubId, e) => {
    e.stopPropagation();
    
    // Find the club in our local state to check its isPrivate status
    const club = filteredClubs.find(c => c._id === clubId);
    console.log('[Frontend] Joining club:', clubId, 'isPrivate:', club?.isPrivate);
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/api/clubs/${clubId}/join`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('[Frontend] Join response:', response.data);
      if (response.data.success) {
        // Check if we received a clubId (public club - auto-joined)
        if (response.data.clubId) {
          // Navigate directly to the club page
          navigate(`/club/${response.data.clubId}`);
        } else {
          // Private club - request sent, awaiting approval
          alert("Join request sent! Awaiting leader approval.");
        }
      }
    } catch (error) {
      console.error("Error joining club:", error);
      const errorMsg = error.response?.data?.message || "Failed to join club";
      alert(errorMsg);
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
        // Redirect to the club page
        const clubId = response.data.clubId || response.data.club?._id;
        if (clubId) {
          navigate(`/club/${clubId}`);
        } else {
          setShowJoinModal(false);
          alert("Joined club successfully!");
        }
      }
    } catch {
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
              Enter the invite code from a club leader to join.
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
      {/* Top Navigation Bar */}
      <nav className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">DriveClique</h1>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <input
            type="text"
            placeholder="Search clubs, drives, or members..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-3 px-4 text-sm focus:outline-none focus:border-red-600"
          />
        </div>

        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/dashboard")} className="p-3 hover:bg-zinc-900 rounded-full">
            <Home className="w-6 h-6" />
          </button>
          <button onClick={() => navigate("/my-clubs")} className="p-3 hover:bg-zinc-900 rounded-full">
            <Users className="w-6 h-6" />
          </button>
          <button className="p-3 hover:bg-zinc-900 rounded-full relative">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">3</span>
          </button>
          <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden cursor-pointer" onClick={() => navigate("/profile")}>
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-full h-full p-1" />
            )}
          </div>
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-red-500">Logout</button>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main Content */}
        <div className="flex-1 max-w-4xl min-h-screen p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold">Find Clubs</h1>
            <p className="text-zinc-400 mt-1">Discover and join car clubs in your area</p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by club name, description, or location..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-red-600"
            />
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-zinc-400">
              {filteredClubs.length} club{filteredClubs.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {/* Clubs Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-zinc-400">Loading clubs...</p>
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-20">
              <Car className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-zinc-400">No clubs found</h2>
              <p className="text-zinc-500 mt-2">Try a different search term or create your own club</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredClubs.map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="bg-zinc-900 rounded-3xl p-6 cursor-pointer hover:bg-zinc-800 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{club.name}</h3>
                        {club.isPrivate && (
                          <Lock className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <p className="text-zinc-400 mb-4 line-clamp-2">
                        {club.description || "No description available"}
                      </p>
                      <div className="flex items-center gap-6 text-sm text-zinc-500">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{club.members.length} members</span>
                        </div>
                        {club.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{club.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>{club.isPrivate ? "Private" : "Public"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      {club.members.some((member) => 
                        typeof member === 'string' ? member === user._id : member._id === user._id
                      ) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/club/${club._id}`);
                          }}
                          className="bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-2xl font-medium whitespace-nowrap"
                        >
                          View Club
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleJoinClub(club._id, e)}
                          className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl font-medium whitespace-nowrap"
                        >
                          Join Club
                        </button>
                      )}
                      <div className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden">
                        {club.avatar ? (
                          <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                            <span className="text-white font-bold text-xl">
                              {club.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 hidden xl:block p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <h3 className="font-semibold mb-4">Popular Clubs</h3>
          <div className="space-y-4">
            {publicClubs
              .sort((a, b) => b.members.length - a.members.length)
              .slice(0, 5)
              .map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-zinc-900 p-2 rounded-xl transition"
                >
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden">
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
                  <div>
                    <p className="font-medium">{club.name}</p>
                    <p className="text-xs text-zinc-500">{club.members.length} members</p>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-6">
            <button
              onClick={handleJoinByCode}
              className="w-full bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl flex items-center justify-center gap-2 font-medium transition"
            >
              <Lock size={20} /> Join with Code
            </button>
          </div>

          <h3 className="font-semibold mb-4 mt-8">Why Join a Club?</h3>
          <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Connect with enthusiasts</p>
                <p className="text-xs text-zinc-500">Meet people who share your passion</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Exclusive events</p>
                <p className="text-xs text-zinc-500">Access members-only drives</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Share knowledge</p>
                <p className="text-xs text-zinc-500">Learn from experienced owners</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindClub;