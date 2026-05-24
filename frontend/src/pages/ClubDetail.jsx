import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Users, Calendar, Home, Search, Bell, Copy, Check, X, ArrowLeft } from "lucide-react";

const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState("members");

  useEffect(() => {
    const fetchClubDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `http://localhost:5000/api/clubs/${clubId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.data.success) {
          setClub(response.data.club);
        }
      } catch (error) {
        console.error("Error fetching club:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClubDetails();
  }, [clubId]);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(club.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `http://localhost:5000/api/auth/search?query=${searchQuery}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        setSearchResults(response.data.users);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading club...</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Club not found</p>
      </div>
    );
  }

  const currentUser = JSON.parse(localStorage.getItem("driveclique_user") || "{}");
  const isLeader = club.leader._id === currentUser._id;

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
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        <div className="w-72 hidden lg:block border-r border-zinc-800 p-4 sticky top-16 h-screen overflow-y-auto">
          <div className="space-y-2">
            <div onClick={() => navigate("/dashboard")} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer">
              <Home className="w-6 h-6" />
              <span className="font-medium">Home</span>
            </div>
            <div onClick={() => navigate("/my-clubs")} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer">
              <Users className="w-6 h-6" />
              <span>My Clubs</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer bg-zinc-900">
              <Calendar className="w-6 h-6 text-red-500" />
              <span className="font-medium">{club.name}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-4xl min-h-screen p-8">
          <button
            onClick={() => navigate("/my-clubs")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
          >
            <ArrowLeft size={20} />
            Back to My Clubs
          </button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold">{club.name}</h1>
            <p className="text-zinc-400 mt-2">{club.description}</p>
            {club.location && <p className="text-zinc-500 mt-1">{club.location}</p>}
          </div>

          {isLeader && (
            <div className="bg-zinc-900 rounded-3xl p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Club Settings</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-400">
                    {club.isPrivate ? "Private Club" : "Public Club"}
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("token");
                        await axios.post(
                          `http://localhost:5000/api/clubs/${club._id}/toggle-privacy`,
                          { isPrivate: !club.isPrivate },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        setClub({ ...club, isPrivate: !club.isPrivate });
                      } catch (error) {
                        console.error("Error toggling privacy:", error);
                      }
                    }}
                    className={`relative w-12 h-6 rounded-full transition ${
                      club.isPrivate ? "bg-red-600" : "bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
                        club.isPrivate ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold mb-4">Invite Members</h2>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 bg-black rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-lg">{club.inviteCode}</span>
                  <button
                    onClick={copyInviteCode}
                    className="text-red-500 hover:text-red-400 flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-6">
                <h3 className="font-medium mb-4">Find Users to Invite</h3>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                  />
                  <Search className="absolute right-4 top-3.5 text-zinc-500 w-5 h-5" />
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map((user) => (
                      <div key={user._id} className="flex items-center justify-between bg-black rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-700 rounded-full"></div>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-sm text-zinc-500">{user.email}</p>
                          </div>
                        </div>
                        <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-sm">
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-zinc-900 rounded-3xl p-6">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setActiveTab("members")}
                className={`px-6 py-3 rounded-2xl font-medium transition ${
                  activeTab === "members"
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Members ({club.members.length})
              </button>
              {isLeader && club.joinRequests && club.joinRequests.length > 0 && (
                <button
                  onClick={() => setActiveTab("requests")}
                  className={`px-6 py-3 rounded-2xl font-medium transition ${
                    activeTab === "requests"
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  Requests ({club.joinRequests.filter((r) => r.status === "pending").length})
                </button>
              )}
            </div>

            {activeTab === "members" && (
              <div className="space-y-3">
                {club.members.map((member) => (
                  <div key={member._id} className="flex items-center gap-4 bg-black rounded-xl px-4 py-3">
                    <div className="w-12 h-12 bg-zinc-700 rounded-full"></div>
                    <div className="flex-1">
                      <p className="font-medium">{member.username}</p>
                      <p className="text-sm text-zinc-500">{member.email}</p>
                    </div>
                    {member._id === club.leader._id && (
                      <span className="text-amber-500 text-sm flex items-center gap-1">Leader</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "requests" && isLeader && (
              <div className="space-y-3">
                {club.joinRequests
                  .filter((r) => r.status === "pending")
                  .map((request) => (
                    <div key={request._id} className="flex items-center gap-4 bg-black rounded-xl px-4 py-3">
                      <div className="w-12 h-12 bg-zinc-700 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">{request.user?.username || "Unknown User"}</p>
                        <p className="text-sm text-zinc-500">Wants to join your club</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="bg-green-600 hover:bg-green-700 p-3 rounded-xl">
                          <Check size={18} />
                        </button>
                        <button className="bg-red-600 hover:bg-red-700 p-3 rounded-xl">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                {club.joinRequests.filter((r) => r.status === "pending").length === 0 && (
                  <p className="text-zinc-500 text-center py-8">No pending requests</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-80 hidden xl:block p-6 sticky top-16 h-screen overflow-y-auto">
          <h3 className="font-semibold mb-4">Club Info</h3>
          <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-500">Members</p>
              <p className="text-2xl font-bold">{club.members.length}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Leader</p>
              <p className="font-medium">{club.leader.username}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Invite Code</p>
              <p className="font-mono text-lg">{club.inviteCode}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClubDetail;