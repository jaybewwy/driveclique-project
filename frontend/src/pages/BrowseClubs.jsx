import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Users, Calendar, Home, Search, Bell, Lock, Globe } from "lucide-react";

const BrowseClubs = ({ onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }
        const filterParam = filter === "public" ? "&filter=public" : "";
        const response = await axios.get(
          `http://localhost:5000/api/clubs/browse?query=${searchQuery}${filterParam}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.data.success) {
          setClubs(response.data.clubs);
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching clubs:", err);
        setError(err.response?.data?.message || "Failed to load clubs");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchQuery, filter, navigate]);

  const handleJoinClub = async (clubId) => {
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
      if (response.data.success) {
        alert(response.data.message);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to join club");
    }
  };

  const handleJoinByCode = async () => {
    const code = prompt("Enter invite code:");
    if (!code) return;
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/api/clubs/join-by-code/${code}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        alert("Joined club successfully!");
        navigate("/my-clubs");
      }
    } catch (error) {
      alert(error.response?.data?.message || "Invalid invite code");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading clubs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/my-clubs")}
            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl font-medium"
          >
            Go Back
          </button>
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
          <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden cursor-pointer">
            <img src="https://i.pravatar.cc/128?u=alex" alt="Profile" />
          </div>
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-red-500">Logout</button>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        {/* Left Sidebar - Navigation */}
        <div className="w-72 hidden lg:block border-r border-zinc-800 p-4 sticky top-16 h-screen overflow-y-auto">
          <div className="space-y-2">
            <div
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer"
            >
              <Home className="w-6 h-6" />
              <span className="font-medium">Home</span>
            </div>

            <div
              onClick={() => navigate("/my-clubs")}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer"
            >
              <Users className="w-6 h-6" />
              <span>My Clubs</span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer bg-zinc-900">
              <Search className="w-6 h-6 text-red-500" />
              <span className="font-medium">Browse Clubs</span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer">
              <Calendar className="w-6 h-6" />
              <span>Upcoming Drives</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-4xl min-h-screen p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Browse Clubs</h1>
              <p className="text-zinc-400 mt-1">Discover and join car communities</p>
            </div>
            <button
              onClick={handleJoinByCode}
              className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl flex items-center gap-2 font-medium"
            >
              <Lock size={18} /> Join with Code
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-8">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs by name..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-3 pl-12 focus:outline-none focus:border-red-600"
              />
              <Search className="absolute left-4 top-3.5 text-zinc-500 w-5 h-5" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-6 py-3 rounded-2xl font-medium transition ${
                  filter === "all"
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("public")}
                className={`px-6 py-3 rounded-2xl font-medium transition ${
                  filter === "public"
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Public
              </button>
            </div>
          </div>

          {/* Clubs Grid */}
          {clubs.length === 0 ? (
            <div className="bg-zinc-900 rounded-3xl p-12 text-center">
              <Search className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Clubs Found</h2>
              <p className="text-zinc-400">
                {filter === "public"
                  ? "No public clubs match your search."
                  : "No clubs match your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {clubs.map((club) => {
                const currentUser = JSON.parse(localStorage.getItem("driveclique_user") || "{}");
                const isLeader = club.leader._id === currentUser._id;
                return (
                  <div
                    key={club._id}
                    className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                            <Car className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-semibold">{club.name}</h3>
                              {club.isPrivate ? (
                                <Lock size={14} className="text-zinc-500" />
                              ) : (
                                <Globe size={14} className="text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">
                              Led by {club.leader.username} • {club.members.length} members
                            </p>
                          </div>
                        </div>
                        <p className="text-zinc-400 text-sm mb-3">{club.description}</p>
                        {club.location && (
                          <p className="text-zinc-500 text-sm">{club.location}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {!isLeader && !club.isPrivate && (
                          <button
                            onClick={() => handleJoinClub(club._id)}
                            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl font-medium transition whitespace-nowrap"
                          >
                            Join Club
                          </button>
                        )}
                        {!isLeader && club.isPrivate && (
                          <div className="text-sm text-zinc-500 text-center">
                            <Lock size={14} className="inline mr-1" />
                            Invite only
                          </div>
                        )}
                        <button
                          onClick={() => navigate(`/club/${club._id}`)}
                          className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl font-medium transition whitespace-nowrap"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 hidden xl:block p-6 sticky top-16 h-screen overflow-y-auto">
          <h3 className="font-semibold mb-4">Club Stats</h3>
          <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-500">Total Clubs</p>
              <p className="text-2xl font-bold">{clubs.length}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Public Clubs</p>
              <p className="text-2xl font-bold text-green-500">
                {clubs.filter((c) => !c.isPrivate).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Private Clubs</p>
              <p className="text-2xl font-bold text-amber-500">
                {clubs.filter((c) => c.isPrivate).length}
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-500 mb-2">Total Members</p>
              <p className="text-2xl font-bold">
                {clubs.reduce((sum, c) => sum + c.members.length, 0)}
              </p>
            </div>
          </div>

          <div className="mt-6 bg-zinc-900 rounded-2xl p-4">
            <h4 className="font-semibold mb-3 text-sm">Quick Tips</h4>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li>• Public clubs can be joined instantly</li>
              <li>• Private clubs require an invite code</li>
              <li>• Contact the leader for private club invites</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowseClubs;