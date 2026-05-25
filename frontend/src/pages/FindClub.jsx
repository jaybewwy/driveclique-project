import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Home, Search, Bell, User, MapPin, Lock, Globe, Users, Calendar } from "lucide-react";
import Sidebar from "../components/Sidebar";

const FindClub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter clubs based on search query
  const filteredClubs = searchQuery.trim()
    ? clubs.filter(club =>
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (club.description && club.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (club.location && club.location.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : clubs;

  const handleJoinClub = async (clubId, e) => {
    e.stopPropagation();
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
        alert("Join request sent!");
      }
    } catch (error) {
      console.error("Error joining club:", error);
      alert("Failed to join club");
    }
  };

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
            <h1 className="text-4xl font-bold">Find A Club</h1>
            <p className="text-zinc-400 mt-1">Discover and join car clubs in your area</p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by club name, description, or location..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-4 pl-12 text-lg focus:outline-none focus:border-red-600"
              />
              <Search className="absolute left-4 top-4.5 text-zinc-500 w-6 h-6" />
            </div>
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
                      <button
                        onClick={(e) => handleJoinClub(club._id, e)}
                        className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl font-medium whitespace-nowrap"
                      >
                        Join Club
                      </button>
                      <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex-shrink-0"></div>
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
            {clubs
              .sort((a, b) => b.members.length - a.members.length)
              .slice(0, 5)
              .map((club) => (
                <div
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-zinc-900 p-2 rounded-xl transition"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl"></div>
                  <div>
                    <p className="font-medium">{club.name}</p>
                    <p className="text-xs text-zinc-500">{club.members.length} members</p>
                  </div>
                </div>
              ))}
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