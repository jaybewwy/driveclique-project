import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  Copy,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  MoreVertical,
  CalendarDays,
  Crown,
  Users,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import { compressImage } from "../utils/imageCompressor";
import { clubsAPI, drivesAPI, authAPI } from "../services/api";
import { DriveSchedulerPicker } from "../components/ui/drive-scheduler-picker";
import { LocationSearch } from "../components/ui/location-search";

const ClubDetail = ({ user, onLogout }) => {
  const { clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  const [copied, setCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [drives, setDrives] = useState([]);

  const [selectedDrive, setSelectedDrive] = useState(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showAllDrivesModal, setShowAllDrivesModal] = useState(false);
  const [showPastEventsModal, setShowPastEventsModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [showClubEditModal, setShowClubEditModal] = useState(false);
  const [clubEditFormData, setClubEditFormData] = useState({});
  const [clubAvatarPreview, setClubAvatarPreview] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // RSVP state (modal-scoped — reset when modal closes)
  const [userRSVP, setUserRSVP] = useState(null); // 'going', 'maybe', 'not-going', 'waitlisted', or null
  const [userWaitlistPosition, setUserWaitlistPosition] = useState(null);
  const [rsvpCounts, setRsvpCounts] = useState({ going: 0, maybe: 0, notGoing: 0, waitlisted: 0 });
  const [isRSVPLoading, setIsRSVPLoading] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState('');

  // Persistent per-drive RSVP counts (survive modal close, used by drive cards)
  const [driveRSVPCounts, setDriveRSVPCounts] = useState({});

  // Schedule Drive modal state
  const [showScheduleDriveModal, setShowScheduleDriveModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    description: '',
    image: ''
  });
  const [driveImagePreview, setDriveImagePreview] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState('');
  const [clubEditError, setClubEditError] = useState('');
  const [memberActionError, setMemberActionError] = useState('');
  const [driveToDelete, setDriveToDelete] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferError, setTransferError] = useState('');

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '' });
  const [announcementError, setAnnouncementError] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(null); // announcementId being deleted, or 'posting'

  // Fetch club details and drives
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clubResponse, drivesResponse] = await Promise.all([
          clubsAPI.getClubById(clubId),
          drivesAPI.getClubDrives(clubId),
        ]);
        if (clubResponse.data?.success) {
          setClub(clubResponse.data.club);
          setAnnouncements((clubResponse.data.club.announcements || []).slice().reverse());
        }
        if (drivesResponse.data?.success) setDrives(drivesResponse.data.drives || []);
      } catch (error) {
        console.error("Error fetching club data:", error);
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
  const isMember = club?.members?.some(
    m => (m._id?.toString() || m?.toString()) === userId
  ) ?? false;
  const hasPendingRequest = club?.joinRequests?.some(
    r => r.user?.toString() === userId && r.status === 'pending'
  ) ?? false;

  // Pre-fetch RSVP counts for all upcoming drives once they are loaded,
  // so the drive cards show live counts immediately (before the modal is opened).
  useEffect(() => {
    if (drives.length === 0) return;
    const upcomingIds = drives
      .filter(d => !d.isCancelled && !d.isCompleted && new Date(d.date) >= new Date())
      .map(d => d._id);

    upcomingIds.forEach(driveId => {
      drivesAPI.getRSVPStatus(driveId)
        .then(res => {
          if (res.data?.success) {
            setDriveRSVPCounts(prev => ({
              ...prev,
              [driveId]: {
                going: res.data.counts.going,
                maybe: res.data.counts.maybe,
                notGoing: res.data.counts.notGoing
              }
            }));
          }
        })
        .catch(() => {});
    });
  }, [drives]);

  const copyInviteCode = () => {
    if (!club?.inviteCode) return;
    navigator.clipboard.writeText(club.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDriveClick = async (drive) => {
    setSelectedDrive(drive);
    // Fetch RSVP data for this drive
    await fetchDriveRSVPData(drive._id);
    setShowDriveModal(true);
  };

  const closeDriveModal = () => {
    setShowDriveModal(false);
    setSelectedDrive(null);
    setUserRSVP(null);
    setRsvpCounts({ going: 0, maybe: 0, notGoing: 0 });
    setRsvpMessage('');
  };

  // Fetch RSVP data for a drive (counts + current user's status)
  // Uses the /rsvp-status endpoint which is accessible to all authenticated members.
  // Updates both the modal-scoped rsvpCounts AND the persistent driveRSVPCounts map
  // so that drive cards reflect live counts even after the modal is closed.
  const fetchDriveRSVPData = async (driveId) => {
    try {
      const response = await drivesAPI.getRSVPStatus(driveId);
      if (response.data?.success) {
        const counts = {
          going:      response.data.counts.going,
          maybe:      response.data.counts.maybe,
          notGoing:   response.data.counts.notGoing,
          waitlisted: response.data.counts.waitlisted ?? 0,
        };
        // Update modal counts (shown inside the open modal)
        setRsvpCounts(counts);
        // Update the persistent per-drive map (shown on the drive card, survives modal close)
        setDriveRSVPCounts(prev => ({ ...prev, [driveId]: counts }));
        // Restore the user's existing RSVP status and waitlist position
        setUserRSVP(response.data.userStatus);
        setUserWaitlistPosition(response.data.waitlistPosition ?? null);
      }
    } catch (error) {
      console.error('Error fetching RSVP data:', error);
    }
  };

  // Handle RSVP submission (for modal)
  const handleRSVP = async (status) => {
    if (isRSVPLoading) return;
    
    setIsRSVPLoading(true);
    setRsvpMessage('');
    
    try {
      const response = await drivesAPI.rsvp(selectedDrive._id, status);
      
      if (response.data?.success) {
        setUserRSVP(status);
        setRsvpMessage(response.data.message);
        
        // Refresh RSVP counts
        await fetchDriveRSVPData(selectedDrive._id);
        
        // Clear message after 3 seconds
        setTimeout(() => setRsvpMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      setRsvpMessage(error.response?.data?.message || 'Failed to submit RSVP');
      setTimeout(() => setRsvpMessage(''), 3000);
    } finally {
      setIsRSVPLoading(false);
    }
  };

  const closeAllDrivesModal = () => {
    setShowAllDrivesModal(false);
  };

  // Handler functions for drive actions
  const handleMarkComplete = async (drive) => {
    try {
      const response = await drivesAPI.update(drive._id, { isCompleted: true });
      if (response.data?.success) {
        setDrives(drives.map(d => d._id === drive._id ? response.data.drive : d));
        setShowActionMenu(null);
      }
    } catch (error) {
      console.error("Error marking drive as complete:", error);
    }
  };

  const handleDeleteDrive = async (drive) => {
    setDriveToDelete(drive);
    setShowActionMenu(null);
  };

  const confirmDeleteDrive = async () => {
    if (!driveToDelete) return;
    try {
      const response = await drivesAPI.delete(driveToDelete._id);
      if (response.data?.success) {
        setDrives(drives.filter(d => d._id !== driveToDelete._id));
      }
    } catch (error) {
      console.error("Error deleting drive:", error);
    } finally {
      setDriveToDelete(null);
    }
  };

  const handleEditDrive = (drive) => {
    setEditFormData({
      name: drive.name,
      date: new Date(drive.date).toISOString().split('T')[0],
      time: drive.time || '',
      location: drive.location || '',
      description: drive.description || '',
    });
    setSelectedDrive(drive);
    setShowEditModal(true);
    setShowActionMenu(null);
  };

  const handleUpdateDrive = async () => {
    try {
      const updateData = { ...editFormData };
      if (updateData.date) updateData.date = new Date(updateData.date).toISOString();
      const response = await drivesAPI.update(selectedDrive._id, updateData);
      if (response.data?.success) {
        setDrives(drives.map(d => d._id === selectedDrive._id ? response.data.drive : d));
        setShowEditModal(false);
        setSelectedDrive(null);
        setEditFormData({});
      }
    } catch (error) {
      console.error("Error updating drive:", error);
    }
  };

  // Club edit handlers
  const openClubEditModal = () => {
    setClubEditFormData({
      name: club.name,
      description: club.description || '',
      location: club.location || '',
      avatar: club.avatar || '',
      isPrivate: club.isPrivate || false,
    });
    setClubAvatarPreview(club.avatar || '');
    setTransferTarget(null);
    setTransferError('');
    setShowClubEditModal(true);
  };

  const closeClubEditModal = () => {
    setShowClubEditModal(false);
    setClubEditFormData({});
    setClubAvatarPreview('');
    setAvatarFileName('');
    setTransferTarget(null);
    setTransferError('');
  };

  const handleUpdateClub = async () => {
    setClubEditError('');
    if (clubEditFormData.description && clubEditFormData.description.length < 10) {
      setClubEditError('Description must be at least 10 characters long');
      return;
    }
    try {
      const response = await clubsAPI.update(clubId, clubEditFormData);
      if (response.data?.success) {
        setClub(response.data.club);
        closeClubEditModal();
      }
    } catch (error) {
      setClubEditError(error.response?.data?.message || 'Failed to update club. Please try again.');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const { compressedData, fileName } = await compressImage(file);
        setClubEditFormData({ ...clubEditFormData, avatar: compressedData });
        setClubAvatarPreview(compressedData);
        setAvatarFileName(fileName);
      } catch (error) {
        console.error('Error compressing image:', error);
        setClubEditError('Failed to process image. Please try again.');
      }
    }
  };

  const handleRemoveMember = (memberId, memberUsername) => {
    setMemberToRemove({ id: memberId, username: memberUsername });
    setMemberActionError('');
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      const response = await clubsAPI.removeMember(clubId, memberToRemove.id);
      if (response.data?.success) {
        setClub(prevClub => ({
          ...prevClub,
          members: prevClub.members.filter(m => m._id !== memberToRemove.id)
        }));
        setMemberToRemove(null);
      }
    } catch (error) {
      setMemberActionError(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    setTransferError('');
    try {
      const response = await clubsAPI.transfer(clubId, transferTarget._id);
      if (response.data?.success) {
        setClub(response.data.club);
        closeClubEditModal();
      }
    } catch (err) {
      setTransferError(err.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  const handleLeaveClub = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveClub = async () => {
    try {
      const response = await clubsAPI.leave(clubId);
      if (response.data?.success) {
        navigate('/my-clubs');
      }
    } catch (error) {
      console.error('Error leaving club:', error);
    } finally {
      setShowLeaveConfirm(false);
    }
  };

  const cancelLeaveClub = () => {
    setShowLeaveConfirm(false);
  };

  const handleJoinClub = async () => {
    setJoinLoading(true);
    setJoinFeedback('');
    try {
      const response = await clubsAPI.requestToJoin(clubId);
      if (response.data.success) {
        if (response.data.clubId) {
          // Public club — joined immediately; refresh club data so isMember updates
          const refreshed = await clubsAPI.getClubById(clubId);
          if (refreshed.data?.success) setClub(refreshed.data.club);
        } else {
          setJoinFeedback('Join request sent! Awaiting leader approval.');
        }
      }
    } catch (err) {
      setJoinFeedback(err.response?.data?.message || 'Failed to send join request.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDeleteClubConfirm = async () => {
    if (!deleteEmail || !deleteReason) {
      setMemberActionError('Please fill in all fields');
      return;
    }
    try {
      const response = await clubsAPI.delete(clubId, deleteReason, deleteEmail);
      if (response.data?.success) {
        navigate('/my-clubs');
      }
    } catch (error) {
      setMemberActionError(error.response?.data?.message || 'Failed to delete club');
    }
  };

  // Schedule Drive handlers
  const openScheduleDriveModal = () => {
    setScheduleForm({ name: '', date: '', time: '', location: '', description: '', image: '' });
    setDriveImagePreview('');
    setSelectedDate(null);
    setValidationError(null);
    setShowScheduleDriveModal(true);
  };

  const closeScheduleDriveModal = () => {
    setShowScheduleDriveModal(false);
    setScheduleForm({ name: '', date: '', time: '', location: '', description: '', image: '' });
    setDriveImagePreview('');
    setValidationError(null);
  };

  const handleDriveImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { compressedData } = await compressImage(file);
      setScheduleForm(prev => ({ ...prev, image: compressedData }));
      setDriveImagePreview(compressedData);
    } catch {
      setValidationError('Failed to process image. Please try again.');
    }
  };

  const handleScheduleFormChange = (e) => {
    setScheduleForm({ ...scheduleForm, [e.target.name]: e.target.value });
    setValidationError(null);
  };

  const getFormattedDate = () => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const validateScheduleForm = () => {
    const formattedDate = getFormattedDate();
    if (!scheduleForm.name.trim()) {
      setValidationError('Drive name is required');
      return false;
    }
    if (!formattedDate) {
      setValidationError('Please select a valid date');
      return false;
    }
    if (!scheduleForm.time.trim()) {
      setValidationError('Please select a time');
      return false;
    }
    if (!scheduleForm.location.trim()) {
      setValidationError('Location is required');
      return false;
    }
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    if (selectedDate < todayObj) {
      setValidationError('Cannot schedule a drive in the past');
      return false;
    }
    return true;
  };

  const handleScheduleDrive = async () => {
    if (!validateScheduleForm()) return;
    setIsScheduling(true);
    try {
      const response = await drivesAPI.create({
        clubId,
        name: scheduleForm.name,
        date: getFormattedDate(),
        time: scheduleForm.time,
        location: scheduleForm.location,
        description: scheduleForm.description || ''
      });
      if (response.data?.success) {
        const drivesResponse = await drivesAPI.getClubDrives(clubId);
        if (drivesResponse.data?.success) setDrives(drivesResponse.data.drives || []);
        closeScheduleDriveModal();
      }
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Failed to schedule drive.');
    } finally {
      setIsScheduling(false);
    }
  };

  // Filter and sort drives for display
  const upcomingDrives = drives
    .filter((drive) => !drive.isCancelled && !drive.isCompleted && new Date(drive.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastDrives = drives
    .filter((drive) => drive.isCompleted || new Date(drive.date) < new Date())
    .filter((drive) => !drive.isCancelled)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredAndSortedDrives = upcomingDrives;

  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await authAPI.searchUsers(searchQuery);
      if (response.data?.success) setSearchResults(response.data.users);
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
      <div className="bg-zinc-950 flex items-center justify-center">
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
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <div className="flex-1 min-w-0 max-w-4xl min-h-screen p-4 lg:p-6 xl:p-8">
          <button
            onClick={() => navigate("/my-clubs")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
          >
            <ArrowLeft size={20} />
            Back to My Clubs
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border-4 border-zinc-700">
                {club.avatar ? (
                  <img
                    src={club.avatar}
                    alt={club.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-orange-600">
                    <span className="text-white text-3xl font-bold">
                      {club.name?.charAt(0)?.toUpperCase?.()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-bold">{club.name}</h1>
                <p className="text-zinc-400 mt-2">{club.description}</p>
                {club.location && <p className="text-zinc-500 mt-1">{club.location}</p>}
              </div>
            </div>
          </div>

          {/* Next Upcoming Drive - Displayed prominently in center */}
          {upcomingDrives.length > 0 ? (
            <div className="mb-8">
              {/* Section Header */}
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-orange-600/10 rounded-full blur-xl" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                      <CalendarDays className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Next Scheduled Drive</h3>
                      <p className="text-xs text-zinc-500">Don't miss out on the upcoming event</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Drive Card - New Design */}
              <div
                className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-zinc-800/50 transition-all duration-300 group ${isMember || isLeader ? 'cursor-pointer hover:border-zinc-700/50' : 'cursor-default opacity-80'}`}
                onClick={() => (isMember || isLeader) && handleDriveClick(upcomingDrives[0])}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2 group-hover:text-red-400 transition-colors">
                      {upcomingDrives[0].name}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(upcomingDrives[0].date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {upcomingDrives[0].time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {upcomingDrives[0].time}
                        </span>
                      )}
                      {upcomingDrives[0].location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {upcomingDrives[0].location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {driveRSVPCounts[upcomingDrives[0]?._id]?.going ?? 0} going
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowRight className="w-5 h-5 text-red-500" />
                  </div>
                </div>
              </div>

              {upcomingDrives.length > 1 && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="bg-zinc-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-700/30">
                    <p className="text-zinc-500 text-sm">
                      +{upcomingDrives.length - 1} more upcoming drive{upcomingDrives.length > 2 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                  <CalendarDays className="w-8 h-8 text-zinc-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">No Upcoming Drives</h2>
                <p className="text-zinc-500 text-sm mb-4">
                  {isLeader 
                    ? "Schedule your first drive to get started!" 
                    : "Check back later for upcoming events."}
                </p>
                {isLeader && (
                  <button
                    onClick={openScheduleDriveModal}
                    className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition"
                  >
                    <Plus size={18} />
                    Schedule a Drive
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Announcements Section — visible to all on public clubs, members/leader only on private clubs */}
          {(!club.isPrivate || isMember || isLeader) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Announcements</h3>
                    <p className="text-xs text-zinc-500">Updates from the club leader</p>
                  </div>
                </div>
                {isLeader && (
                  <button
                    onClick={() => { setShowAnnouncementForm(v => !v); setAnnouncementError(''); }}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    {showAnnouncementForm ? <X size={15} /> : <Plus size={15} />}
                    {showAnnouncementForm ? 'Cancel' : 'Post Announcement'}
                  </button>
                )}
              </div>

              {/* Post Announcement Form */}
              {isLeader && showAnnouncementForm && (
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 mb-4">
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Title (optional)"
                      value={announcementForm.title}
                      maxLength={100}
                      onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
                    />
                    <div className="relative">
                      <textarea
                        placeholder="Write your announcement..."
                        value={announcementForm.body}
                        maxLength={1000}
                        rows={4}
                        onChange={e => { setAnnouncementForm(f => ({ ...f, body: e.target.value })); setAnnouncementError(''); }}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition resize-none"
                      />
                      <span className="absolute bottom-2 right-3 text-xs text-zinc-600">{announcementForm.body.length}/1000</span>
                    </div>
                    {announcementError && <p className="text-red-400 text-sm">{announcementError}</p>}
                    <div className="flex justify-end">
                      <button
                        disabled={isPostingAnnouncement === 'posting'}
                        onClick={async () => {
                          if (!announcementForm.body.trim()) {
                            setAnnouncementError('Announcement cannot be empty.');
                            return;
                          }
                          setIsPostingAnnouncement('posting');
                          try {
                            const res = await clubsAPI.postAnnouncement(clubId, {
                              title: announcementForm.title.trim(),
                              body: announcementForm.body.trim()
                            });
                            if (res.data?.success) {
                              setAnnouncements(prev => [res.data.announcement, ...prev]);
                              setAnnouncementForm({ title: '', body: '' });
                              setShowAnnouncementForm(false);
                            }
                          } catch {
                            setAnnouncementError('Failed to post announcement. Please try again.');
                          } finally {
                            setIsPostingAnnouncement(null);
                          }
                        }}
                        className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-6 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPostingAnnouncement === 'posting' ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Announcement Cards */}
              {announcements.length === 0 ? (
                <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-2xl p-6 text-center">
                  <p className="text-zinc-500 text-sm">No announcements yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a._id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {a.title && <p className="font-semibold text-white mb-1">{a.title}</p>}
                          <p className="text-zinc-300 text-sm whitespace-pre-wrap">{a.body}</p>
                          <p className="text-zinc-600 text-xs mt-2">
                            {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}
                            {new Date(a.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        {isLeader && (
                          <button
                            disabled={isPostingAnnouncement === a._id}
                            onClick={async () => {
                              setIsPostingAnnouncement(a._id);
                              try {
                                await clubsAPI.deleteAnnouncement(clubId, a._id);
                                setAnnouncements(prev => prev.filter(x => x._id !== a._id));
                              } catch {
                                /* silent — card stays */
                              } finally {
                                setIsPostingAnnouncement(null);
                              }
                            }}
                            className="text-zinc-600 hover:text-red-400 transition flex-shrink-0 disabled:opacity-40"
                            title="Delete announcement"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-56 lg:w-64 xl:w-72 2xl:w-80 flex-none hidden lg:flex flex-col p-3 xl:p-5 2xl:p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
          <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">Club Info</h3>

          <div className="bg-zinc-900 rounded-xl xl:rounded-2xl p-3 xl:p-4 space-y-2 xl:space-y-4">
            <div>
              <p className="text-sm text-zinc-500">Leader</p>
              <p className="font-medium">
                {club.leader?.useDisplayName && club.leader?.name
                  ? club.leader.name
                  : club.leader?.username}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3 xl:pt-5 mt-3 xl:mt-5">
            <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">Drive and Events</h3>

            {filteredAndSortedDrives.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-4">
                <p className="text-zinc-500 text-sm">No drives scheduled yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 xl:space-y-3">
                  {filteredAndSortedDrives.slice(0, 2).map((drive) => (
                    <div
                      key={drive._id}
                      className="bg-zinc-900/50 backdrop-blur-sm rounded-xl xl:rounded-2xl p-3 xl:p-4 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group relative overflow-visible"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`flex-1 ${isMember || isLeader ? 'cursor-pointer' : 'cursor-default'}`}
                          onClick={() => (isMember || isLeader) && handleDriveClick(drive)}
                        >
                          <h4 className="font-semibold mb-2 group-hover:text-red-400 transition-colors">
                            {drive.name}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(drive.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            {drive.time && (
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                                </svg>
                                {drive.time}
                              </span>
                            )}
                          </div>
                        </div>
                        {isLeader && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowActionMenu(showActionMenu === drive._id ? null : drive._id);
                              }}
                              className="p-1 hover:bg-zinc-700 rounded-lg transition"
                            >
                              <MoreVertical size={14} className="text-zinc-400" />
                            </button>
                            {showActionMenu === drive._id && (
                              <div className="absolute right-0 top-8 bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 z-50 min-w-[140px]">
                                <button
                                  onClick={() => handleEditDrive(drive)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 flex items-center gap-2 rounded-t-xl transition"
                                >
                                  <Edit3 size={14} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleMarkComplete(drive)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 flex items-center gap-2 transition"
                                >
                                  <CheckCircle size={14} />
                                  Mark Complete
                                </button>
                                <button
                                  onClick={() => handleDeleteDrive(drive)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-900/50 text-red-400 flex items-center gap-2 rounded-b-xl transition"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  {filteredAndSortedDrives.length > 3 && (
                    <button
                      onClick={() => setShowAllDrivesModal(true)}
                      className="flex-1 text-red-500 hover:text-red-400 text-sm font-medium transition py-2 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-700/30"
                    >
                      View All ({filteredAndSortedDrives.length})
                    </button>
                  )}
                  {pastDrives.length > 0 && (
                    <button
                      onClick={() => setShowPastEventsModal(true)}
                      className="flex-1 text-zinc-500 hover:text-zinc-400 text-sm font-medium transition py-2 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-700/30"
                    >
                      Past Events ({pastDrives.length})
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Members section - visible to all members */}
          <div className="mt-3 xl:mt-4">
            {isLeader && (
              <button
                onClick={openScheduleDriveModal}
                className="w-full bg-red-600 hover:bg-red-700 py-2 xl:py-3 rounded-xl xl:rounded-2xl text-sm xl:text-base font-medium flex items-center justify-center gap-2 transition mb-3 xl:mb-4"
              >
                <Plus size={18} />
                Schedule a Drive
              </button>
            )}

            <div className="border-t border-zinc-800 pt-3 xl:pt-5">
              <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">
                {isLeader ? "Club Settings" : "Members"}
              </h3>

              {isLeader && (
                <>
                  <button
                    type="button"
                    onClick={openClubEditModal}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 py-2 xl:py-3 rounded-xl xl:rounded-2xl text-sm xl:text-base font-medium flex items-center justify-center gap-2 transition mb-3 xl:mb-4"
                  >
                    <Edit3 size={18} />
                    Manage Club
                  </button>
                </>
              )}

              <div className="bg-zinc-900 rounded-xl xl:rounded-2xl p-3 xl:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs xl:text-sm text-zinc-500">Members</p>
                    <p className="text-xl xl:text-2xl font-bold text-red-500">{club.members?.length || 0}</p>
                  </div>
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="text-red-500 hover:text-red-400 text-sm font-medium transition"
                  >
                    View All
                  </button>
                </div>
              </div>
            </div>

            {!isLeader && isMember && (
              <div className="mt-3 xl:mt-6 pt-3 xl:pt-5 border-t border-zinc-800">
                <button
                  onClick={handleLeaveClub}
                  className="w-full bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-600 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition"
                >
                  <X size={18} />
                  Leave Club
                </button>
              </div>
            )}

            {!isLeader && !isMember && (
              <div className="mt-3 xl:mt-6 pt-3 xl:pt-5 border-t border-zinc-800">
                {joinFeedback && (
                  <p className="text-sm text-center mb-3 text-zinc-400">{joinFeedback}</p>
                )}
                {!hasPendingRequest && !joinFeedback && (
                  <button
                    onClick={handleJoinClub}
                    disabled={joinLoading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={18} />
                    {joinLoading ? 'Joining...' : 'Join Club'}
                  </button>
                )}
                {hasPendingRequest && !joinFeedback && (
                  <p className="text-sm text-center text-zinc-500">
                    Join request pending approval
                  </p>
                )}
              </div>
            )}

            {isLeader && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* All Drives Modal */}
      {showAllDrivesModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">All Drives & Events</h2>
              <button
                type="button"
                onClick={closeAllDrivesModal}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {filteredAndSortedDrives.map((drive) => (
                <div
                  key={drive._id}
                  onClick={() => {
                    setSelectedDrive(drive);
                    setShowDriveModal(true);
                    closeAllDrivesModal();
                  }}
                  className="bg-black rounded-2xl p-4 cursor-pointer hover:bg-zinc-800 transition"
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

            <div className="pt-4 mt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={closeAllDrivesModal}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">All Members ({club.members?.length || 0})</h2>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {(club.members || []).map((member) => {
                const memberIsLeader = club.leader?._id && member._id === club.leader._id;
                return (
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
                      <p className="text-sm text-zinc-500">@{member.username}</p>
                      {member.car && (member.car.year || member.car.make || member.car.model) && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                          {member.car.year} {member.car.make} {member.car.model}
                        </p>
                      )}
                    </div>

                    {memberIsLeader ? (
                      <span className="text-amber-500 text-sm flex items-center gap-1 bg-amber-900/30 px-3 py-1 rounded-full">
                        <Crown size={12} /> Leader
                      </span>
                    ) : isLeader ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member._id, member.username)}
                        className="text-red-500 hover:text-red-400 p-2 hover:bg-red-900/30 rounded-lg transition"
                        title="Remove from club"
                      >
                        <X size={18} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Events Modal */}
      {showPastEventsModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Past Events</h2>
              <button
                type="button"
                onClick={() => setShowPastEventsModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {pastDrives.map((drive) => (
                <div
                  key={drive._id}
                  onClick={() => {
                    if (!(isMember || isLeader)) return;
                    setSelectedDrive(drive);
                    setShowDriveModal(true);
                    setShowPastEventsModal(false);
                  }}
                  className={`bg-black rounded-2xl p-4 transition ${isMember || isLeader ? 'cursor-pointer hover:bg-zinc-800' : 'cursor-default opacity-80'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{drive.name}</p>
                    {drive.isCompleted && (
                      <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full">
                        Completed
                      </span>
                    )}
                  </div>
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

            <div className="pt-4 mt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowPastEventsModal(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drive Modal */}
      {showEditModal && selectedDrive && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Drive</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedDrive(null);
                }}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Date</label>
                <input
                  type="date"
                  value={editFormData.date || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Time</label>
                <input
                  type="text"
                  value={editFormData.time || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                  placeholder="e.g., 10:00 AM"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Location</label>
                <input
                  type="text"
                  value={editFormData.location || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Description</label>
                <textarea
                  value={editFormData.description || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedDrive(null);
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDrive}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDriveModal && selectedDrive && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl">
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

            <div className="space-y-6">
              {/* Drive Details */}
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

              {selectedDrive.image && (
                <img
                  src={selectedDrive.image}
                  alt="Drive route"
                  className="w-full h-40 object-cover rounded-xl border border-zinc-800"
                />
              )}

              {selectedDrive.description && (
                <div className="bg-black rounded-xl p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{selectedDrive.description}</p>
                </div>
              )}

              {/* RSVP Section - Members and leaders only */}
              {new Date(selectedDrive.date) >= new Date() && !selectedDrive.isCompleted && (
                <div className="border-t border-zinc-700 pt-6">
                  {!(isMember || isLeader) ? (
                    <p className="text-sm text-zinc-500 text-center py-2">
                      Join this club to RSVP to drives.
                    </p>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold mb-4">
                        {isLeader ? 'Mark your attendance' : 'Are you going?'}
                      </h3>

                      {/* State 1 — user is on the waitlist */}
                      {userRSVP === 'waitlisted' ? (
                        <div className="mb-4 bg-amber-900/20 border border-amber-600/40 rounded-2xl p-4 text-center">
                          <Clock className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                          <p className="text-amber-400 font-semibold">You are #{userWaitlistPosition} on the waitlist</p>
                          <p className="text-xs text-zinc-500 mt-1">You'll be automatically confirmed when a spot opens up</p>
                          <button
                            type="button"
                            onClick={() => handleRSVP('not-going')}
                            disabled={isRSVPLoading}
                            className="mt-3 text-sm text-zinc-400 hover:text-red-400 transition disabled:opacity-50"
                          >
                            Leave Waitlist
                          </button>
                        </div>
                      ) : (
                        /* State 2 (drive full) or State 3 (normal) */
                        <div className="flex gap-3 mb-4">
                          {/* Going — or Join Waitlist when drive is at capacity */}
                          {rsvpCounts.going >= (selectedDrive?.maxAttendees ?? Infinity) && userRSVP !== 'going' ? (
                            <button
                              type="button"
                              onClick={() => handleRSVP('going')}
                              disabled={isRSVPLoading}
                              className="flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 bg-zinc-800 hover:bg-amber-900/30 text-white hover:text-amber-400 border border-zinc-700 hover:border-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Clock size={18} />
                              Join Waitlist
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRSVP('going')}
                              disabled={isRSVPLoading}
                              className={`flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 ${
                                userRSVP === 'going'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-zinc-800 hover:bg-green-900/30 text-white hover:text-green-400 border border-zinc-700 hover:border-green-600'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <CheckCircle size={18} />
                              Going
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRSVP('maybe')}
                            disabled={isRSVPLoading}
                            className={`flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 ${
                              userRSVP === 'maybe'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-zinc-800 hover:bg-yellow-900/30 text-white hover:text-yellow-400 border border-zinc-700 hover:border-yellow-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <CalendarDays size={18} />
                            Maybe
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRSVP('not-going')}
                            disabled={isRSVPLoading}
                            className={`flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 ${
                              userRSVP === 'not-going'
                                ? 'bg-red-600 text-white'
                                : 'bg-zinc-800 hover:bg-red-900/30 text-white hover:text-red-400 border border-zinc-700 hover:border-red-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <X size={18} />
                            Not Going
                          </button>
                        </div>
                      )}

                      {/* RSVP Message */}
                      {rsvpMessage && (
                        <div className="mb-4 p-3 bg-green-900/30 border border-green-600 rounded-xl">
                          <p className="text-green-400 text-sm text-center">{rsvpMessage}</p>
                        </div>
                      )}

                      {/* RSVP Counts */}
                      <div className="border-t border-zinc-700/50 pt-4">
                        <h4 className="text-sm font-semibold mb-3 text-zinc-400">
                          {isLeader ? 'RSVP Summary' : 'Current RSVPs'}
                        </h4>
                        <div className="flex gap-4">
                          <div className="flex-1 bg-black rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-green-400">{rsvpCounts.going}</p>
                            <p className="text-xs text-zinc-500">Going</p>
                          </div>
                          <div className="flex-1 bg-black rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-yellow-400">{rsvpCounts.maybe}</p>
                            <p className="text-xs text-zinc-500">Maybe</p>
                          </div>
                          <div className="flex-1 bg-black rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-red-400">{rsvpCounts.notGoing}</p>
                            <p className="text-xs text-zinc-500">Not Going</p>
                          </div>
                          {rsvpCounts.waitlisted > 0 && (
                            <div className="flex-1 bg-black rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-amber-400">{rsvpCounts.waitlisted}</p>
                              <p className="text-xs text-zinc-500">Waitlisted</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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

      {/* Club Edit Modal */}
      {showClubEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Club</h2>
              <button
                type="button"
                onClick={closeClubEditModal}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            {clubEditError && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded-xl">
                <p className="text-red-400 text-sm">{clubEditError}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Club Avatar */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Club Avatar</label>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 border-2 border-zinc-600">
                    {clubAvatarPreview ? (
                      <img
                        src={clubAvatarPreview}
                        alt="Club avatar preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : club.avatar ? (
                      <img
                        src={club.avatar}
                        alt="Club avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-zinc-500 text-xs">No Image</span>
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl font-medium text-sm transition flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    Choose Image
                  </label>
                  {avatarFileName && (
                    <p className="text-xs text-zinc-500">Selected: {avatarFileName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="club-edit-name" className="block text-sm text-zinc-400 mb-2">Club Name</label>
                <input
                  id="club-edit-name"
                  type="text"
                  value={clubEditFormData.name || ''}
                  onChange={(e) => setClubEditFormData({ ...clubEditFormData, name: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="club-edit-description" className="block text-sm text-zinc-400 mb-2">Description</label>
                <textarea
                  id="club-edit-description"
                  value={clubEditFormData.description || ''}
                  onChange={(e) => setClubEditFormData({ ...clubEditFormData, description: e.target.value })}
                  rows={3}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Location</label>
                <LocationSearch
                  value={clubEditFormData.location || ''}
                  onChange={(val) => setClubEditFormData({ ...clubEditFormData, location: val })}
                />
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Privacy Setting</p>
                    <p className="text-xs text-zinc-400">
                      {clubEditFormData.isPrivate ? 'Private - Only invited members can join' : 'Public - Anyone can request to join'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClubEditFormData({ ...clubEditFormData, isPrivate: !clubEditFormData.isPrivate })}
                    className={`relative w-10 h-5 rounded-full transition ${
                      clubEditFormData.isPrivate ? "bg-red-600" : "bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${
                        clubEditFormData.isPrivate ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Transfer Ownership */}
              <div className="border-t border-zinc-700 pt-4 mt-4">
                <h3 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                  <Crown size={16} />
                  Transfer Ownership
                </h3>
                <p className="text-zinc-400 text-sm mb-3">
                  Select a member to become the new club leader. You will become a regular member.
                </p>
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {(club.members || [])
                    .filter(m => (m._id?.toString() || m?.toString()) !== userId)
                    .map(member => (
                      <button
                        key={member._id}
                        type="button"
                        onClick={() => setTransferTarget(member)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                          transferTarget?._id === member._id
                            ? 'bg-amber-500/20 border border-amber-500/50'
                            : 'bg-zinc-800 hover:bg-zinc-700 border border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {member.avatar
                            ? <img src={member.avatar} alt={member.username} className="w-full h-full object-cover" />
                            : <span className="text-xs font-bold">{member.username?.charAt(0)?.toUpperCase()}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.useDisplayName && member.name ? member.name : member.username}</p>
                          <p className="text-xs text-zinc-500">@{member.username}</p>
                        </div>
                        {transferTarget?._id === member._id && (
                          <Crown size={14} className="text-amber-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
                {transferError && <p className="text-red-400 text-sm mb-2">{transferError}</p>}
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  disabled={!transferTarget}
                  className="w-full bg-amber-600 hover:bg-amber-500 py-2 rounded-xl font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  <Crown size={15} />
                  Transfer to {transferTarget ? (transferTarget.useDisplayName && transferTarget.name ? transferTarget.name : transferTarget.username) : '...'}
                </button>
              </div>

              {/* Danger Zone - Delete Club */}
              <div className="border-t border-zinc-700 pt-4 mt-4">
                <div className="bg-red-900/20 border border-red-600 rounded-xl p-4">
                  <h3 className="text-red-400 font-medium mb-3 flex items-center gap-2">
                    <Trash2 size={16} />
                    Danger Zone
                  </h3>
                  <p className="text-red-300 text-sm mb-3">
                    Permanently delete this club and all associated data. This action cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 size={16} />
                    Delete Club
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeClubEditModal}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateClub}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Drive Modal */}
      {showScheduleDriveModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-2xl w-full border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Schedule a Drive</h2>
              </div>
              <button
                type="button"
                onClick={closeScheduleDriveModal}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            {validationError && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-xl">
                <p className="text-red-400 text-sm">{validationError}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Drive Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Drive Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={scheduleForm.name}
                  onChange={handleScheduleFormChange}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  placeholder="e.g. Mountain Run, Cars and Coffee"
                />
              </div>

              {/* Date & Time Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <DriveSchedulerPicker
                  selectedDate={selectedDate}
                  selectedTime={scheduleForm.time}
                  onDateChange={handleDateSelect}
                  onTimeChange={(time) => {
                    setScheduleForm((prev) => ({ ...prev, time }));
                    setValidationError(null);
                  }}
                  minDate={new Date()}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={scheduleForm.location}
                  onChange={handleScheduleFormChange}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  placeholder="e.g. Mountain View Parking Lot, 123 Main St"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={scheduleForm.description}
                  onChange={handleScheduleFormChange}
                  rows={3}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
                  placeholder="Additional details about the drive..."
                />
              </div>

              {/* Route Image (Optional) */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Route Image <span className="text-zinc-500 text-xs">(Optional)</span>
                </label>
                {driveImagePreview ? (
                  <div className="relative">
                    <img src={driveImagePreview} alt="Drive route" className="w-full h-32 object-cover rounded-xl border border-zinc-700" />
                    <button
                      type="button"
                      onClick={() => { setDriveImagePreview(''); setScheduleForm(prev => ({ ...prev, image: '' })); }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 p-1 rounded-lg transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 transition">
                    <MapPin size={20} className="text-zinc-500 mb-1" />
                    <span className="text-xs text-zinc-500">Upload route map or photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleDriveImageUpload} />
                  </label>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeScheduleDriveModal}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleScheduleDrive}
                  disabled={isScheduling}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isScheduling ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CalendarDays size={18} />
                      Schedule Drive
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Club Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Leave Club</h2>
              <button
                type="button"
                onClick={cancelLeaveClub}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <p className="text-zinc-300 text-center text-lg">
                Are you sure you want to leave this club?
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelLeaveClub}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveClub}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Club Confirmation Modal */}

      {/* Delete Drive Confirmation */}
      {driveToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Delete Drive</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-medium">{driveToDelete.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDriveToDelete(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDrive}
                className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Remove Member</h3>
            <p className="text-zinc-400 text-sm mb-2">
              Are you sure you want to remove <span className="text-white font-medium">@{memberToRemove.username}</span> from this club?
            </p>
            {memberActionError && (
              <p className="text-red-400 text-sm mb-3">{memberActionError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setMemberToRemove(null); setMemberActionError(''); }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveMember}
                className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-red-600 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-red-400">Delete Club</h2>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteEmail('');
                  setDeleteReason('');
                }}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            {memberActionError && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded-xl">
                <p className="text-red-400 text-sm">{memberActionError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-red-900/20 border border-red-600 rounded-xl p-4">
                <p className="text-red-300 text-sm">
                  <strong>Warning:</strong> This action is permanent and cannot be undone. All club data, drives, and member information will be deleted.
                </p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Confirm Leader Email
                  <span className="text-zinc-500 text-xs ml-1">(Must match the club leader's email)</span>
                </label>
                <input
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder="leader@example.com"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Reason for Deletion
                  <span className="text-zinc-500 text-xs ml-1">(Optional, helps us improve)</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  placeholder="Why are you deleting this club?"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteEmail('');
                    setDeleteReason('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClubConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
                >
                  Delete Permanently
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

