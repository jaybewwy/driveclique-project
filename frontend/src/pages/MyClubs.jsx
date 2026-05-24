import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Crown, Copy } from "lucide-react";

const MOCK_CLUBS = [
  {
    _id: 1,
    name: "Southern California Mountain Drivers",
    description: "Weekend mountain runs and car meets",
    inviteCode: "DRIVE2025",
    memberCount: 47,
    isLeader: true,
  },
  {
    _id: 2,
    name: "Tokyo Midnight Syndicate",
    description: "Late night drives and JDM culture",
    inviteCode: "TMS2026",
    memberCount: 28,
    isLeader: false,
  },
];

const MyClubs = () => {
  const navigate = useNavigate();
  const [clubs] = useState(MOCK_CLUBS);

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Invite code "${code}" copied!`);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="bg-black border-b border-zinc-800 px-8 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">My Clubs</h1>
            <p className="text-zinc-400">Manage your car communities</p>
          </div>
          <button
            onClick={() => navigate("/create-club")}
            className="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-2xl flex items-center gap-3 font-medium"
          >
            <Plus size={24} /> Create New Club
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {clubs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-zinc-400">
              You have not joined any clubs yet
            </p>
            <button className="mt-6 bg-red-600 px-8 py-4 rounded-2xl">
              Browse Clubs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {clubs.map((club) => (
              <div
                key={club._id}
                className="bg-zinc-900 rounded-3xl p-8 hover:scale-105 transition-all border border-zinc-800"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-semibold">{club.name}</h3>
                    {club.isLeader && (
                      <div className="flex items-center gap-1 text-amber-500 text-sm mt-1">
                        <Crown size={16} /> Leader
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-red-500">
                      {club.memberCount}
                    </div>
                    <div className="text-xs text-zinc-500">members</div>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm mb-6 line-clamp-2">
                  {club.description}
                </p>

                <div className="bg-zinc-800 rounded-2xl p-4 mb-6">
                  <div className="text-xs text-zinc-500 mb-1">Invite Code</div>
                  <div className="flex items-center justify-between bg-black rounded-xl px-4 py-3">
                    <span className="font-mono text-lg tracking-widest">
                      {club.inviteCode}
                    </span>
                    <button
                      onClick={() => copyInviteCode(club.inviteCode)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/clubs/${club._id}`)}
                    className="flex-1 bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-medium"
                  >
                    View Club
                  </button>
                  {club.isLeader && (
                    <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-medium">
                      Manage
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClubs;