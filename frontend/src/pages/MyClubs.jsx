import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Users, Calendar, Home, Search, Bell, Plus, Crown, Copy } from "lucide-react";

const MyClubs = ({ onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);

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
    alert(`Invite code "${code}" copied!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading clubs...</p>
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
                      <div className="text-xs text-zinc-500 mb-1">Invite Code</div>
                      <div className="flex items-center justify-between bg-black rounded-xl px-3 py-2">
                        <span className="font-mono text-sm tracking-widest">
                          {club.inviteCode}
                        </span>
                        <button
                          onClick={() => copyInviteCode(club.inviteCode)}
                          className="text-red-500 hover:text-red-400"
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