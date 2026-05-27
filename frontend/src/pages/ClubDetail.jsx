import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
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
  ChevronLeft,
  ChevronRight,
  Crown,
  Users,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import { compressImage } from "../utils/imageCompressor";

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

  // RSVP state
  const [userRSVP, setUserRSVP] = useState(null); // 'going', 'maybe', 'not-going', or null
  const [rsvpCounts, setRsvpCounts] = useState({ going: 0, maybe: 0, notGoing: 0 });
  const [isRSVPLoading, setIsRSVPLoading] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState('');

  // Schedule Drive modal state
  const [showScheduleDriveModal, setShowScheduleDriveModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    description: ''
  });
  const [timePeriod, setTimePeriod] = useState('AM');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [validationError, setValidationError] = useState(null);

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

  // Fetch RSVP data for a drive
  const fetchDriveRSVPData = async (driveId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch attendees data (for leader) or just get counts
      if (isLeader) {
        const response = await axios.get(
          `http://localhost:5000/api/drives/${driveId}/attendees`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data?.success) {
          setRsvpCounts({
            going: response.data.stats.going,
            maybe: response.data.stats.maybe,
            notGoing: response.data.stats.notGoing
          });
        }
      } else {
        // For non-leaders, we'll just show their own RSVP status
        // In a real app, you might have a separate endpoint for this
        const response = await axios.get(
          `http://localhost:5000/api/drives/${driveId}/attendees`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data?.success) {
          setRsvpCounts({
            going: response.data.stats.going,
            maybe: response.data.stats.maybe,
            notGoing: response.data.stats.notGoing
          });
          // Check if current user has an RSVP
          const userRSVPData = response.data.rsvps.find(
            r => r.user._id === userId || r.user === userId
          );
          if (userRSVPData) {
            setUserRSVP(userRSVPData.status);
          }
        }
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
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/drives/${selectedDrive._id}/rsvp`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
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
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `http://localhost:5000/api/drives/${drive._id}`,
        { isCompleted: true },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data?.success) {
        // Update local state
        setDrives(drives.map(d => d._id === drive._id ? response.data.drive : d));
        setShowActionMenu(null);
      }
    } catch (error) {
      console.error("Error marking drive as complete:", error);
    }
  };

  const handleDeleteDrive = async (drive) => {
    if (!window.confirm("Are you sure you want to delete this drive?")) return;
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `http://localhost:5000/api/drives/${drive._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data?.success) {
        // Remove from local state
        setDrives(drives.filter(d => d._id !== drive._id));
        setShowActionMenu(null);
      }
    } catch (error) {
      console.error("Error deleting drive:", error);
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
      const token = localStorage.getItem("token");
      // Ensure date is sent as a proper date string
      const updateData = { ...editFormData };
      if (updateData.date) {
        updateData.date = new Date(updateData.date).toISOString();
      }
      
      console.log("Updating drive:", selectedDrive._id, "with data:", updateData);
      
      const response = await axios.put(
        `http://localhost:5000/api/drives/${selectedDrive._id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      console.log("Response:", response.data);
      
      if (response.data?.success) {
        // Update local state with the returned drive
        const updatedDrive = response.data.drive;
        setDrives(drives.map(d => d._id === selectedDrive._id ? updatedDrive : d));
        setShowEditModal(false);
        setSelectedDrive(null);
        setEditFormData({});
      } else {
        console.error("Update failed:", response.data);
      }
    } catch (error) {
      console.error("Error updating drive:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
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
    setShowClubEditModal(true);
  };

  const closeClubEditModal = () => {
    setShowClubEditModal(false);
    setClubEditFormData({});
    setClubAvatarPreview('');
    setAvatarFileName('');
  };

  const handleUpdateClub = async () => {
    // Validate description length before sending
    if (clubEditFormData.description && clubEditFormData.description.length < 10) {
      alert("Description must be at least 10 characters long");
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:5000/api/clubs/${clubId}`;
      
      console.log("Updating club:", clubId);
      console.log("URL:", url);
      console.log("Token exists:", !!token);
      console.log("Form data:", clubEditFormData);
      
      const response = await axios.put(
        url,
        clubEditFormData,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }
      );
      
      console.log("Response:", response.data);
      
      if (response.data?.success) {
        setClub(response.data.club);
        closeClubEditModal();
      }
    } catch (error) {
      console.error("Error updating club:", error);
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      if (error.response?.status === 404) {
        alert("Club not found. Please refresh the page and try again.");
      } else if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert("Failed to update club. Please check your connection and try again.");
      }
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
        alert('Failed to process image. Please try again.');
      }
    }
  };

  const handleRemoveMember = async (memberId, memberUsername) => {
    if (!window.confirm(`Are you sure you want to remove ${memberUsername} from the club?`)) return;
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `http://localhost:5000/api/clubs/${clubId}/remove-member`,
        { memberId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data?.success) {
        // Update local state to remove the member
        setClub(prevClub => ({
          ...prevClub,
          members: prevClub.members.filter(m => m._id !== memberId)
        }));
      }
    } catch (error) {
      console.error("Error removing member:", error);
      alert(error.response?.data?.message || "Failed to remove member");
    }
  };

  const handleLeaveClub = async () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveClub = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `http://localhost:5000/api/clubs/${clubId}/leave`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data?.success) {
        alert("You have left the club.");
        navigate("/my-clubs");
      }
    } catch (error) {
      console.error("Error leaving club:", error);
      alert(error.response?.data?.message || "Failed to leave club");
    } finally {
      setShowLeaveConfirm(false);
    }
  };

  const cancelLeaveClub = () => {
    setShowLeaveConfirm(false);
  };

  const handleDeleteClubConfirm = async () => {
    if (!deleteEmail || !deleteReason) {
      alert("Please fill in all fields");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `http://localhost:5000/api/clubs/${clubId}`,
        {
          data: { deletionReason: deleteReason, leaderEmail: deleteEmail },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data?.success) {
        navigate("/my-clubs");
      }
    } catch (error) {
      console.error("Error deleting club:", error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      }
    }
  };

  // Schedule Drive handlers
  const openScheduleDriveModal = () => {
    setScheduleForm({ name: '', date: '', time: '', location: '', description: '' });
    setTimePeriod('AM');
    setSelectedDate(null);
    setCalendarMonth(new Date().getMonth());
    setCalendarYear(new Date().getFullYear());
    setValidationError(null);
    setShowScheduleDriveModal(true);
  };

  const closeScheduleDriveModal = () => {
    setShowScheduleDriveModal(false);
    setScheduleForm({ name: '', date: '', time: '', location: '', description: '' });
    setValidationError(null);
  };

  const handleScheduleFormChange = (e) => {
    setScheduleForm({ ...scheduleForm, [e.target.name]: e.target.value });
    setValidationError(null);
  };

  const handleTimeChange = (hour, minute) => {
    const h = hour || '12';
    const m = minute || '00';
    setScheduleForm(prev => ({ ...prev, time: `${h}:${m} ${timePeriod}` }));
  };

  const handlePeriodChange = (period) => {
    setTimePeriod(period);
    const currentTime = scheduleForm.time;
    if (currentTime) {
      const [time] = currentTime.split(' ');
      setScheduleForm(prev => ({ ...prev, time: `${time} ${period}` }));
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const parseTimeForDropdowns = () => {
    if (!scheduleForm.time) return { hour: '', minute: '', period: 'AM' };
    const [time, period] = scheduleForm.time.split(' ');
    const [hour, minute] = time.split(':');
    return { hour: parseInt(hour, 10), minute, period: period || 'AM' };
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

  const getDisplayDate = () => {
    if (selectedDate) {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return 'Select a date';
  };

  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isDateDisabled = (day) => {
    const dateToCheck = new Date(calendarYear, calendarMonth, day);
    return dateToCheck < today;
  };

  const isDateSelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === calendarMonth &&
      selectedDate.getFullYear() === calendarYear
    );
  };

  const handleDateSelect = (day) => {
    if (isDateDisabled(day)) return;
    const newDate = new Date(calendarYear, calendarMonth, day);
    setSelectedDate(newDate);
  };

  const getDaysInMonth = () => {
    const year = calendarYear;
    const month = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
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
    const selectedDateObj = new Date(formattedDate);
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    if (selectedDateObj < todayObj) {
      setValidationError('Cannot schedule a drive in the past');
      return false;
    }
    return true;
  };

  const handleScheduleDrive = async () => {
    if (!validateScheduleForm()) return;
    setIsScheduling(true);
    try {
      const token = localStorage.getItem('token');
      const formattedDate = getFormattedDate();
      const response = await axios.post(
        'http://localhost:5000/api/drives',
        {
          clubId: clubId,
          name: scheduleForm.name,
          date: formattedDate,
          time: scheduleForm.time,
          location: scheduleForm.location,
          description: scheduleForm.description || ''
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (response.data?.success) {
        // Refresh drives list
        const drivesResponse = await axios.get(
          `http://localhost:5000/api/drives/club/${clubId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (drivesResponse.data?.success) {
          setDrives(drivesResponse.data.drives || []);
        }
        closeScheduleDriveModal();
      }
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Failed to schedule drive.');
    } finally {
      setIsScheduling(false);
    }
  };

  const { daysInMonth, startingDay } = getDaysInMonth();

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
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `http://localhost:5000/api/auth/users/search?query=${searchQuery}`,
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

        <div className="flex-1 max-w-4xl min-h-screen p-8">
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
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/96?text=Club';
                    }}
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
                className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 cursor-pointer group"
                onClick={() => handleDriveClick(upcomingDrives[0])}
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
                        {rsvpCounts.going} going
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
        </div>

        <div className="w-80 hidden lg:block p-6 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-hidden">
          <h3 className="font-semibold mb-4">Club Info</h3>

          <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
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

            {filteredAndSortedDrives.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-4">
                <p className="text-zinc-500 text-sm">No drives scheduled yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredAndSortedDrives.slice(0, 3).map((drive) => (
                    <div
                      key={drive._id}
                      className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 cursor-pointer group relative overflow-visible"
                    >
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleDriveClick(drive)}
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
                            {drive.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span className="truncate max-w-[100px]">{drive.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        {isLeader ? (
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
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
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
          <div className="mt-4">
            {isLeader && (
              <button
                onClick={openScheduleDriveModal}
                className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition mb-4"
              >
                <Plus size={18} />
                Schedule a Drive
              </button>
            )}

            <div className="border-t border-zinc-800 pt-6">
              <h3 className="font-semibold mb-4">
                {isLeader ? "Club Settings" : "Members"}
              </h3>

              {isLeader && (
                <button
                  type="button"
                  onClick={openClubEditModal}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition mb-4"
                >
                  <Edit3 size={18} />
                  Edit Club Details
                </button>
              )}

              <div className="bg-zinc-900 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Members</p>
                    <p className="text-2xl font-bold text-red-500">{club.members?.length || 0}</p>
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

            {!isLeader && (
              <div className="mt-8 pt-6 border-t border-zinc-800">
                <button
                  onClick={handleLeaveClub}
                  className="w-full bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-600 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition"
                >
                  <X size={18} />
                  Leave Club
                </button>
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
                    setSelectedDrive(drive);
                    setShowDriveModal(true);
                    setShowPastEventsModal(false);
                  }}
                  className="bg-black rounded-2xl p-4 cursor-pointer hover:bg-zinc-800 transition"
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

              {selectedDrive.description && (
                <div className="bg-black rounded-xl p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{selectedDrive.description}</p>
                </div>
              )}

              {/* RSVP Section - Show for all users (members and leaders) for upcoming drives */}
              {new Date(selectedDrive.date) >= new Date() && !selectedDrive.isCompleted && (
                <div className="border-t border-zinc-700 pt-6">
                  {/* RSVP Buttons - Show for everyone */}
                  <h3 className="text-lg font-semibold mb-4">
                    {isLeader ? 'Mark your attendance' : 'Are you going?'}
                  </h3>
                  
                  <div className="flex gap-3 mb-4">
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
                    </div>
                  </div>
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
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/80?text=Club';
                        }}
                      />
                    ) : club.avatar ? (
                      <img
                        src={club.avatar}
                        alt="Club avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/80?text=Club';
                        }}
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
                <label htmlFor="club-edit-location" className="block text-sm text-zinc-400 mb-2">Location</label>
                <input
                  id="club-edit-location"
                  type="text"
                  value={clubEditFormData.location || ''}
                  onChange={(e) => setClubEditFormData({ ...clubEditFormData, location: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
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
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
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

              {/* Date Selection - Box Calendar */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="bg-black border border-zinc-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={goToPreviousMonth}
                      className="p-1 hover:bg-zinc-800 rounded transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-400" />
                    </button>
                    <span className="text-white font-medium text-sm">
                      {monthNames[calendarMonth]} {calendarYear}
                    </span>
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      className="p-1 hover:bg-zinc-800 rounded transition"
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center text-[10px] text-zinc-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: startingDay }, (_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const disabled = isDateDisabled(day);
                      const selected = isDateSelected(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDateSelect(day)}
                          disabled={disabled}
                          className={`aspect-square rounded text-xs font-medium transition flex items-center justify-center ${
                            disabled
                              ? 'text-zinc-700 cursor-not-allowed'
                              : selected
                              ? 'bg-red-600 text-white'
                              : 'text-white hover:bg-zinc-800'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  {selectedDate && (
                    <span className="text-red-400">{getDisplayDate()}</span>
                  )}
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Time <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <select
                    value={parseTimeForDropdowns().hour || ''}
                    onChange={(e) => handleTimeChange(parseInt(e.target.value), parseTimeForDropdowns().minute)}
                    className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition"
                  >
                    <option value="">Hour</option>
                    {hours.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <select
                    value={parseTimeForDropdowns().minute || ''}
                    onChange={(e) => handleTimeChange(parseTimeForDropdowns().hour, e.target.value)}
                    className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition"
                  >
                    <option value="">Min</option>
                    {minutes.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={parseTimeForDropdowns().period}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
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

