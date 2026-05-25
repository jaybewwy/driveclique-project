import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Search,
  Copy,
  Check,
  X,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";

const ClubDetail = ({ user, onLogout }) => {
  const { clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  const [copied, setCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState("members");

  const [drives, setDrives] = useState([]);

  const [selectedDrive, setSelectedDrive] = useState(null);
  const [showDriveModal, setShowDriveModal] = useState(false);

  // Fetch club details and drives
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");

        const clubResponse = await axios.get(
          `http://localhost:5000/api/clubs/${clubId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (clubResponse.data?.success) {
          setClub(clubResponse.data.club);
        }

        const drivesResponse = await axios.get(
          `http://localhost:5000/api/drives/club/${clubId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (drivesResponse.data?.success) {
          setDrives(drivesResponse.data.drives || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clubId]);

  // Get the leader ID - handle both populated object and string reference
  const leaderId = club?.leader?._id?.toString() || club?.leader?.toString() || "";
  const userId = user?._id?.toString() || user?.id?.toString() || "";
  const isLeader = Boolean(leaderId && userId && leaderId === userId);

  const copyInviteCode = () => {
    if (!club?.inviteCode) return;
    navigator.clipboard.writeText(club.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteClub = () => {
    navigate(`/club/${clubId}/delete`);
  };

  const handleDriveClick = (drive) => {
    setSelectedDrive(drive);
    setShowDriveModal(true);
  };

  const closeDriveModal = () => {
    setShowDriveModal(false);
    setSelectedDrive(null);
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
      if (response.data?.success) {
        setSearchResults(response.data.users);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) searchUsers();
      else setSearchResults([]);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

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
                Members ({club.members?.length || 0})
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
                  Requests (
                  {club.joinRequests.filter((r) => r.status === "pending").length})
                </button>
              )}
            </div>

            {activeTab === "members" && (
              <div className="space-y-3">
                {(club.members || []).map((member) => (
                  <div
                    key={member._id}
                    className="flex items-center gap-4 bg-black rounded-xl px-4 py-3"
                  >
                    <div className="w-12 h-12 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-zinc-500 text-sm">
                            {member.username?.charAt(0)?.toUpperCase?.()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-medium">
                        {member.useDisplayName && member.name ? member.name : member.username}
                      </p>
                      {member.car && (member.car.year || member.car.make || member.car.model) && (
                        <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
                          {member.car.year} {member.car.make} {member.car.model}
                        </p>
                      )}
                    </div>

                    {club.leader?._id && member._id === club.leader._id && (
                      <span className="text-amber-500 text-sm flex items-center gap-1">
                        Leader
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "requests" && isLeader && (
              <div className="space-y-3">
                {(club.joinRequests || [])
                  .filter((r) => r.status === "pending")
                  .map((request) => (
                    <div
                      key={request._id}
                      className="flex items-center gap-4 bg-black rounded-xl px-4 py-3"
                    >
                      <div className="w-12 h-12 bg-zinc-700 rounded-full" />

                      <div className="flex-1">
                        <p className="font-medium">
                          {request.user?.username || "Unknown User"}
                        </p>
                        <p className="text-sm text-zinc-500">Wants to join your club</p>
                      </div>

                      <div className="flex gap-2">
                        <button className="bg-green-600 hover:bg-green-700 p-3 rounded-xl" type="button">
                          <Check size={18} />
                        </button>
                        <button className="bg-red-600 hover:bg-red-700 p-3 rounded-xl" type="button">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}

                {(club.joinRequests || []).filter((r) => r.status === "pending").length === 0 && (
                  <p className="text-zinc-500 text-center py-8">No pending requests</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-80 hidden xl:block p-6 sticky top-16 self-start">
          <h3 className="font-semibold mb-4">Club Info</h3>

          <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-500">Members</p>
              <p className="text-2xl font-bold">{club.members?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Leader</p>
              <p className="font-medium">
                {club.leader?.useDisplayName && club.leader?.name
                  ? club.leader.name
                  : club.leader?.username}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-6 mt-6">
            <h3 className="font-semibold mb-4">Drive and Events</h3>

            {drives.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-4">
                <p className="text-zinc-500 text-sm">No drives scheduled yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drives
                  .filter((drive) => !drive.isCancelled)
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((drive) => (
                    <div
                      key={drive._id}
                      onClick={() => handleDriveClick(drive)}
                      className="bg-zinc-900 rounded-2xl p-4 cursor-pointer hover:bg-zinc-800 transition"
                    >
                      <p className="font-medium text-sm mb-2">{drive.name}</p>
                      <div className="space-y-1 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} />
                          <span>
                            {new Date(drive.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {drive.time && (
                          <div className="flex items-center gap-2">
                            <Clock size={12} />
                            <span>{drive.time}</span>
                          </div>
                        )}
                        {drive.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={12} />
                            <span className="truncate">{drive.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {isLeader && (
            <div className="mt-4">
              <button
                onClick={() => navigate(`/club/${clubId}/schedule-drive`)}
                className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition"
              >
                <Plus size={18} />
                Schedule a Drive
              </button>

              <div className="border-t border-zinc-800 pt-6 mt-6">
                <h3 className="font-semibold mb-4">Club Settings</h3>

                <div className="bg-zinc-900 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">
                      {club.isPrivate ? "Private Club" : "Public Club"}
                    </span>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("token");
                          await axios.post(
                            `http://localhost:5000/api/clubs/${club._id}/toggle-privacy`,
                            { isPrivate: !club.isPrivate },
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );
                          setClub({ ...club, isPrivate: !club.isPrivate });
                        } catch (error) {
                          console.error("Error toggling privacy:", error);
                        }
                      }}
                      className={`relative w-10 h-5 rounded-full transition ${
                        club.isPrivate ? "bg-red-600" : "bg-zinc-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${
                          club.isPrivate ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold mb-4 mt-8">Invite Members</h3>
                <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
                  <div className="bg-black rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="font-mono text-sm">{club.inviteCode}</span>
                    <button
                      type="button"
                      onClick={copyInviteCode}
                      className="text-red-500 hover:text-red-400 flex items-center gap-1 text-sm"
                    >
                      {copied ? (
                        <>
                          <Check size={14} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border-t border-zinc-800 pt-4">
                    <h4 className="font-medium mb-3 text-sm">Find Users to Invite</h4>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by username..."
                        className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                      />
                      <Search className="absolute right-3 top-2.5 text-zinc-500 w-4 h-4" />
                    </div>

                    {searchResults.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {searchResults.map((u) => (
                          <div
                            key={u._id}
                            className="flex items-center justify-between bg-black rounded-xl px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-zinc-700 rounded-full" />
                              <span className="text-sm">{u.username}</span>
                            </div>
                            <button className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg text-xs" type="button">
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-6 mt-6">
                  <h3 className="font-semibold mb-4 text-red-500">Danger Zone</h3>
                  <div className="bg-red-900/20 border border-red-600 rounded-2xl p-4">
                    <p className="text-red-400 text-sm mb-3">
                      Permanently delete this club and all associated data.
                    </p>
                    <button
                      type="button"
                      onClick={handleDeleteClub}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition"
                    >
                      <Trash2 size={18} />
                      Delete Club
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDriveModal && selectedDrive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{selectedDrive.name}</h2>
              <button
                type="button"
                onClick={closeDriveModal}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-zinc-300">
                  <Calendar size={18} className="text-red-500" />
                  <span>
                    {new Date(selectedDrive.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {selectedDrive.time && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <Clock size={18} className="text-red-500" />
                    <span>{selectedDrive.time}</span>
                  </div>
                )}

                {selectedDrive.location && (
                  <div className="flex items-center gap-3 text-zinc-300">
                    <MapPin size={18} className="text-red-500" />
                    <span>{selectedDrive.location}</span>
                  </div>
                )}
              </div>

              {selectedDrive.description && (
                <div className="bg-black rounded-xl p-4 mt-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{selectedDrive.description}</p>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={closeDriveModal}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubDetail;

