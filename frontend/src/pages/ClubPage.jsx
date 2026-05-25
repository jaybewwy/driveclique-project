import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Crown, Copy, LogOut, Users } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

const ClubPage = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLeader, setIsLeader] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const fetchClubData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get token from localStorage
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('driveclique_user'));

        if (!token) {
          navigate('/login');
          return;
        }

        // Fetch club details
        const clubResponse = await fetch(`${API_BASE_URL}/clubs/${clubId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!clubResponse.ok) {
          if (clubResponse.status === 404) {
            throw new Error('Club not found');
          }
          if (clubResponse.status === 401) {
            navigate('/login');
            return;
          }
          throw new Error('Failed to fetch club details');
        }

        const clubData = await clubResponse.json();
        setClub(clubData.club);
        setInviteCode(clubData.club.inviteCode || '');

        // Check if current user is the leader
        if (user && clubData.club.leader && clubData.club.leader._id === user._id) {
          setIsLeader(true);
        } else if (user && clubData.club.leader === user._id) {
          setIsLeader(true);
        }

        // Fetch drives for this club
        const drivesResponse = await fetch(`${API_BASE_URL}/drives/club/${clubId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (drivesResponse.ok) {
          const drivesData = await drivesResponse.json();
          setDrives(drivesData.drives || []);
        } else {
          setDrives([]);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClubData();
  }, [clubId, navigate]);

  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      alert("Invite code copied!");
    }
  };

  const handleScheduleDrive = () => {
    navigate(`/club/${clubId}/schedule-drive`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-xl">Loading club details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  if (!club) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Club Header */}
      <div className="bg-black border-b border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">{club.name}</h1>
            <p className="text-zinc-400 mt-1">{club.description}</p>
          </div>

          {isLeader && (
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
              {isLeader && (
                <button 
                  onClick={handleScheduleDrive}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl flex items-center gap-2"
                >
                  <Calendar size={20} /> Schedule New Drive
                </button>
              )}
            </div>

            {drives.length === 0 ? (
              <div className="bg-zinc-900 rounded-3xl p-8 text-center text-zinc-500">
                No upcoming drives scheduled. {isLeader ? 'Be the first to schedule one!' : 'Check back later.'}
              </div>
            ) : (
              drives.map(drive => (
                <div key={drive._id} className="bg-zinc-900 rounded-3xl p-8 mb-6">
                  <h3 className="text-xl font-semibold">{drive.name}</h3>
                  <p className="text-zinc-400">
                    {new Date(drive.date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })} 
                    {drive.time && ` • ${drive.time}`}
                  </p>
                  <p className="text-zinc-500 mt-1">{drive.location}</p>
                  {drive.description && (
                    <p className="text-zinc-400 mt-2">{drive.description}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="w-96 bg-zinc-900 rounded-3xl p-8 h-fit sticky top-8">
            <h3 className="font-semibold mb-4">Club Info</h3>
            <div className="space-y-4">
              {inviteCode && (
                <div>
                  <div className="text-sm text-zinc-500">Invite Code</div>
                  <div className="flex items-center justify-between bg-black rounded-xl p-4 mt-2">
                    <span className="font-mono text-lg">{inviteCode}</span>
                    <button onClick={copyInviteCode} className="text-red-500">
                      <Copy size={20} />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-zinc-500 flex items-center gap-2">
                  <Users size={16} /> Members
                </div>
                <div className="text-3xl font-bold mt-1">
                  {club.members ? club.members.length : 0}
                </div>
              </div>

              {club.location && (
                <div>
                  <div className="text-sm text-zinc-500">Location</div>
                  <div className="text-lg mt-1">{club.location}</div>
                </div>
              )}
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