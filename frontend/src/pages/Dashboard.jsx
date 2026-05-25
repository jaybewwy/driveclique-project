import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clubsAPI, getErrorMessage } from "../services/api";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const response = await clubsAPI.getAll();
        if (response.data.success) {
          setClubs(response.data.clubs);
        }
      } catch (err) {
        console.error("Error fetching clubs:", err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchClubs();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main Feed */}
        <div className="flex-1 max-w-2xl border-r border-zinc-800 min-h-screen p-6">
          <div className="mb-6">
            <h2 className="text-3xl font-semibold">Dashboard</h2>
            <p className="text-zinc-400">What's happening in the car community?</p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-zinc-900 rounded-3xl p-6 mb-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-zinc-700 rounded-full flex-shrink-0"></div>
              <input 
                type="text" 
                placeholder="What drive are you planning?" 
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-3 focus:outline-none"
              />
            </div>
            <button className="mt-4 w-full bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium">
              Create New Drive
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 hidden xl:block p-6 sticky top-16 h-screen overflow-y-auto">
          <h3 className="font-semibold mb-4">Your Clubs</h3>
          {loading ? (
            <p className="text-zinc-500 text-sm">Loading clubs...</p>
          ) : error ? (
            <p className="text-zinc-500 text-sm">Unable to load clubs</p>
          ) : clubs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No clubs yet</p>
          ) : (
            <div className="space-y-4">
              {clubs.map((club) => (
                <div 
                  key={club._id} 
                  className="flex items-center gap-3 cursor-pointer hover:bg-zinc-900 p-2 rounded-xl transition"
                  onClick={() => navigate(`/club/${club._id}`)}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl"></div>
                  <div>
                    <p className="font-medium">{club.name}</p>
                    <p className="text-xs text-zinc-500">{club.members.length} members</p>
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

export default Dashboard;