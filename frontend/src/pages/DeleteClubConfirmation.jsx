import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, ArrowLeft, Users, User, Mail, Info, Trash2, XCircle } from 'lucide-react';

const DeleteClubConfirmation = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    clubName: '',
    leaderEmail: '',
    deletionReason: ''
  });
  
  const [clubData, setClubData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch club data on component mount
  useEffect(() => {
    const fetchClubData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/clubs/${clubId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (response.data.success) {
          setClubData(response.data.club);
        }
        setLoading(false);
      } catch {
        setError('Failed to load club information');
        setLoading(false);
      }
    };
    
    fetchClubData();
  }, [clubId]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setValidationError(null);
  };

  const validateForm = () => {
    if (!formData.clubName.trim()) {
      setValidationError('Club name is required');
      return false;
    }
    
    if (!formData.leaderEmail.trim()) {
      setValidationError('Leader email is required');
      return false;
    }
    
    if (!formData.deletionReason.trim()) {
      setValidationError('Deletion reason is required');
      return false;
    }
    
    // Verify club name matches
    if (clubData && formData.clubName.toLowerCase() !== clubData.name.toLowerCase()) {
      setValidationError('Club name does not match. Please type the exact club name.');
      return false;
    }
    
    // Verify email matches club's leader email
    if (clubData && formData.leaderEmail.toLowerCase() !== (clubData.leader?.email || '').toLowerCase()) {
      setValidationError('Email does not match the registered group leader\'s email.');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`http://localhost:5000/api/clubs/${clubId}`, {
        data: {
          deletionReason: formData.deletionReason,
          leaderEmail: formData.leaderEmail
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.status === 200) {
        navigate('/my-clubs', { state: { message: 'Club successfully deleted' } });
      }
    } catch (error) {
      setValidationError(error.response?.data?.message || 'Failed to delete club. Please try again.');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Loading club information...</p>
      </div>
    );
  }

  if (error || !clubData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-2xl font-bold text-white">Error</h2>
          </div>
          <p className="text-zinc-400 mb-6">{error || 'Club not found'}</p>
          <Link 
            to="/my-clubs" 
            className="flex items-center gap-2 text-red-500 hover:text-red-400 font-medium transition"
          >
            <ArrowLeft size={18} />
            Return to My Clubs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/club/${clubId}`)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Club
        </button>

        <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800">
          {/* Header with warning */}
          <div className="bg-red-600/20 border-b border-red-600/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Delete Club Confirmation</h1>
            </div>
            <p className="text-red-300 ml-14">
              This action cannot be undone. Please verify all information carefully.
            </p>
          </div>

          {/* Club Information */}
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-zinc-400" />
              Club Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Club Name</p>
                </div>
                <p className="font-medium text-white">{clubData.name}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Group Leader</p>
                </div>
                <p className="font-medium text-white">
                  {clubData.leader?.useDisplayName && clubData.leader?.name 
                    ? clubData.leader.name 
                    : clubData.leader?.username || 'N/A'}
                </p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Leader Email</p>
                </div>
                <p className="font-medium text-white">{clubData.leader?.email || 'N/A'}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Members</p>
                </div>
                <p className="font-medium text-white">{clubData.members?.length || 0} members</p>
              </div>
            </div>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Verification Required
            </h2>
            
            {validationError && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-xl">
                <p className="text-red-400 text-sm">{validationError}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Club Name Verification */}
              <div>
                <label htmlFor="clubName" className="block text-sm font-medium text-zinc-300 mb-3">
                  Type the club name to confirm <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="clubName"
                  name="clubName"
                  value={formData.clubName}
                  onChange={handleChange}
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  placeholder="Enter club name exactly as shown above"
                  required
                />
              </div>

              {/* Leader Email Verification */}
              <div>
                <label htmlFor="leaderEmail" className="block text-sm font-medium text-zinc-300 mb-3">
                  Group leader's email address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="leaderEmail"
                  name="leaderEmail"
                  value={formData.leaderEmail}
                  onChange={handleChange}
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  placeholder="Enter the group leader's email"
                  required
                />
              </div>

              {/* Deletion Reason */}
              <div>
                <label htmlFor="deletionReason" className="block text-sm font-medium text-zinc-300 mb-3">
                  Reason for deletion <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="deletionReason"
                  name="deletionReason"
                  value={formData.deletionReason}
                  onChange={handleChange}
                  rows="4"
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
                  placeholder="Please explain why you want to delete this club..."
                  required
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4">
              <button
                type="submit"
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-2xl font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    Confirm Deletion
                  </>
                )}
              </button>
              
              <Link
                to={`/club/${clubId}`}
                className="flex-none bg-zinc-800 hover:bg-zinc-700 text-white py-4 px-6 rounded-2xl font-medium transition flex items-center justify-center gap-2"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Additional Warning */}
        <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-400">
                <strong className="font-semibold">Warning:</strong> Deleting this club will permanently remove all associated data including members, events, and drive records. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteClubConfirmation;