import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Crown, Copy, LogOut } from 'lucide-react';

const MOCK_CLUB = (clubId) => ({
  _id: clubId,
  name: "Southern California Mountain Drivers",
  description: "Weekend mountain runs, car meets, and scenic drives.",
  inviteCode: "DRIVE2025",
  memberCount: 47,
  isLeader: true
});

const MOCK_DRIVES = [
  {
    _id: 1,
    name: "Angeles Crest Night Run",
    date: "March 15, 2025",
    time: "7:00 PM",
    location: "La Cañada Flintridge"
  }
];

const ClubPage = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [club] = useState(() => MOCK_CLUB(clubId));
  const [drives] = useState(MOCK_DRIVES);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(club.inviteCode);
    alert("Invite code copied!");
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Club Header */}
      <div className="bg-black border-b border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">{club?.name}</h1>
            <p className="text-zinc-400 mt-1">{club?.description}</p>
          </div>

          {club?.isLeader && (
            <div className="flex items-center gap-2 text-amber-500">
              <Crown size={20} />
              <span className="font-medium">Club Leader</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex gap-8">
          {/* Main Content */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Upcoming Drives</h2>
              {club?.isLeader && (
                <button className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl flex items-center gap-2">
                  <Calendar size={20} /> Schedule New Drive
                </button>
              )}
            </div>

            {drives.map(drive => (
              <div key={drive._id} className="bg-zinc-900 rounded-3xl p-8 mb-6">
                <h3 className="text-xl font-semibold">{drive.name}</h3>
                <p className="text-zinc-400">{drive.date} • {drive.time}</p>
                <p className="text-zinc-500 mt-1">{drive.location}</p>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="w-96 bg-zinc-900 rounded-3xl p-8 h-fit sticky top-8">
            <h3 className="font-semibold mb-4">Club Info</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-zinc-500">Invite Code</div>
                <div className="flex items-center justify-between bg-black rounded-xl p-4 mt-2">
                  <span className="font-mono text-lg">{club?.inviteCode}</span>
                  <button onClick={copyInviteCode} className="text-red-500">
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-500">Members</div>
                <div className="text-3xl font-bold mt-1">{club?.memberCount}</div>
              </div>
            </div>

            <button 
              onClick={() => navigate('/my-clubs')}
              className="w-full mt-8 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              <LogOut size={18} /> Back to My Clubs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClubPage;