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
  Flag,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import ReportModal from "../components/ui/ReportModal";
import AnnouncementsSection from "../components/ui/AnnouncementsSection";
import ScheduleDriveModal from "../components/ui/ScheduleDriveModal";
import DriveDetailModal from "../components/ui/DriveDetailModal";
import ClubTagPicker from "../components/ui/ClubTagPicker";
import { compressImage } from "../utils/imageCompressor";
import { clubsAPI, drivesAPI, authAPI } from "../services/api";
import { LocationSearch } from "../components/ui/location-search";
import { DriveMapPicker } from "../components/ui/drive-map-picker";
import { MobileDrawerButton } from "../components/ui/MobileDrawer";
import { useDocumentFocusTrap } from "../hooks/useFocusTrap";
import { trackEvent } from "../services/analytics";

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
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
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

  // Check-in state (modal-scoped — reset when modal closes)
  const [checkinCounts, setCheckinCounts] = useState({ present: 0, notPresent: 0, pending: 0 });
  const [checkInRequestedAt, setCheckInRequestedAt] = useState(null);
  const [isSendingCheckin, setIsSendingCheckin] = useState(false);
  const [checkinSentMessage, setCheckinSentMessage] = useState('');

  // Attendee list state (leader-only, modal-scoped — reset when modal closes)
  const [showAttendeesList, setShowAttendeesList] = useState(false);
  const [attendeesData, setAttendeesData] = useState(null); // { rsvps, stats } from GET /drives/:id/attendees
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeesError, setAttendeesError] = useState('');

  // Drive rating state (modal-scoped — reset when modal closes)
  const [driveRatingSummary, setDriveRatingSummary] = useState({ average: null, count: 0 });
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingHoverStars, setRatingHoverStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingMessage, setRatingMessage] = useState('');

  // Persistent per-drive RSVP counts (survive modal close, used by drive cards)
  const [driveRSVPCounts, setDriveRSVPCounts] = useState({});

  // Schedule Drive modal — open/close state stays here since it participates in the
  // shared overlay focus-trap/Escape handling below; form fields live in ScheduleDriveModal
  const [showScheduleDriveModal, setShowScheduleDriveModal] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState('');
  const [clubEditError, setClubEditError] = useState('');
  const [memberActionError, setMemberActionError] = useState('');
  const [driveToDelete, setDriveToDelete] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferError, setTransferError] = useState('');

  // Co-leader promote/demote state (UC-10)
  const [coLeaderActionError, setCoLeaderActionError] = useState('');

  // Pending join-request approval state (UC-10)
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [pendingRequestError, setPendingRequestError] = useState('');

  // Cancel Drive state (UC-10 — distinct from Delete Drive; notifies members)
  const [driveToCancel, setDriveToCancel] = useState(null);
  const [cancelDriveReason, setCancelDriveReason] = useState('');
  const [cancelDriveError, setCancelDriveError] = useState('');

  // Report modal state
  const [reportTarget, setReportTarget] = useState(null); // { type, id, name }

  // Announcements state (list is lifted here since it's seeded by the club fetch below;
  // the form/error/posting UI state lives inside AnnouncementsSection)
  const [announcements, setAnnouncements] = useState([]);

  const [clubNotFound, setClubNotFound] = useState(false);

  // Focus trap + restore for whichever overlay (of the many below) is currently open
  const isAnyOverlayOpen = showDriveModal || showAllDrivesModal || showPastEventsModal ||
    showMembersModal || showEditModal || showClubEditModal || showScheduleDriveModal ||
    showLeaveConfirm || showDeleteConfirm || Boolean(driveToDelete) || Boolean(memberToRemove) ||
    Boolean(driveToCancel);
  useDocumentFocusTrap(isAnyOverlayOpen);

  // Escape closes whichever overlay is currently open
  useEffect(() => {
    if (!isAnyOverlayOpen) return;
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      if (showDriveModal) { setShowDriveModal(false); setSelectedDrive(null); }
      else if (showEditModal) { setShowEditModal(false); setSelectedDrive(null); }
      else if (showScheduleDriveModal) setShowScheduleDriveModal(false);
      else if (showAllDrivesModal) setShowAllDrivesModal(false);
      else if (showPastEventsModal) setShowPastEventsModal(false);
      else if (showMembersModal) setShowMembersModal(false);
      else if (showClubEditModal) setShowClubEditModal(false);
      else if (showLeaveConfirm) setShowLeaveConfirm(false);
      else if (showDeleteConfirm) { setShowDeleteConfirm(false); setDeleteEmail(''); setDeleteReason(''); }
      else if (driveToDelete) setDriveToDelete(null);
      else if (memberToRemove) { setMemberToRemove(null); setMemberActionError(''); }
      else if (driveToCancel) { setDriveToCancel(null); setCancelDriveError(''); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAnyOverlayOpen, showDriveModal, showEditModal, showScheduleDriveModal, showAllDrivesModal,
      showPastEventsModal, showMembersModal, showClubEditModal, showLeaveConfirm, showDeleteConfirm,
      driveToDelete, memberToRemove, driveToCancel]);

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
        const status = error?.response?.status;
        if (status === 404 || status === 400) {
          setClubNotFound(true);
        }
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
  // Co-leader is a moderator-tier role (UC-10) — a subset of leader powers
  const isCoLeader = club?.coLeaders?.some(
    m => (m._id?.toString() || m?.toString()) === userId
  ) ?? false;
  const canModerate = isLeader || isCoLeader;
  const pendingJoinRequests = (club?.joinRequests || []).filter(r => r.status === 'pending');

  // Pre-fetch RSVP counts for all upcoming drives in parallel once drives load.
  useEffect(() => {
    if (drives.length === 0) return;
    const upcomingIds = drives
      .filter(d => !d.isCancelled && !d.isCompleted && new Date(d.date) >= new Date())
      .map(d => d._id);
    if (upcomingIds.length === 0) return;

    Promise.all(
      upcomingIds.map(driveId =>
        drivesAPI.getRSVPStatus(driveId)
          .then(res => res.data?.success
            ? { driveId, counts: res.data.counts, failed: false }
            : { driveId, counts: null, failed: true })
          .catch((error) => {
            // Distinguish "failed to load" from "legitimately zero" — a swallowed
            // error here previously rendered as a fake "0 going" on the drive card.
            console.error(`Failed to load RSVP counts for drive ${driveId}:`, error);
            return { driveId, counts: null, failed: true };
          })
      )
    ).then(results => {
      const update = {};
      results.forEach(r => {
        update[r.driveId] = r.failed
          ? { failed: true }
          : { going: r.counts.going, maybe: r.counts.maybe, notGoing: r.counts.notGoing, failed: false };
      });
      setDriveRSVPCounts(prev => ({ ...prev, ...update }));
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
    if (drive.isCompleted) {
      await fetchDriveRatings(drive._id);
    }
    setShowDriveModal(true);
  };

  const closeDriveModal = () => {
    setShowDriveModal(false);
    setSelectedDrive(null);
    setUserRSVP(null);
    setRsvpCounts({ going: 0, maybe: 0, notGoing: 0 });
    setRsvpMessage('');
    setCheckinCounts({ present: 0, notPresent: 0, pending: 0 });
    setCheckInRequestedAt(null);
    setCheckinSentMessage('');
    setShowAttendeesList(false);
    setAttendeesData(null);
    setAttendeesError('');
    setDriveRatingSummary({ average: null, count: 0 });
    setRatingStars(0);
    setRatingHoverStars(0);
    setRatingComment('');
    setRatingMessage('');
  };

  // Fetch the average rating + the current user's own rating (if any) for a completed drive
  const fetchDriveRatings = async (driveId) => {
    try {
      const response = await drivesAPI.getDriveRatings(driveId);
      if (response.data?.success) {
        setDriveRatingSummary({ average: response.data.average, count: response.data.count });
        if (response.data.myRating) {
          setRatingStars(response.data.myRating.stars);
          setRatingComment(response.data.myRating.comment || '');
        }
      }
    } catch (error) {
      console.error('Error fetching drive ratings:', error);
    }
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
        // Check-in results (leader view) and request timestamp (UC-08)
        if (response.data.checkin) {
          setCheckinCounts({
            present: response.data.checkin.present,
            notPresent: response.data.checkin.notPresent,
            pending: response.data.checkin.pending,
          });
        }
        setCheckInRequestedAt(response.data.checkInRequestedAt ?? null);
      }
    } catch (error) {
      console.error('Error fetching RSVP data:', error);
    }
  };

  // Leader sends (or resends) the check-in notification to all "going" members
  const handleSendCheckin = async () => {
    if (!selectedDrive || isSendingCheckin) return;
    setIsSendingCheckin(true);
    setCheckinSentMessage('');
    try {
      const response = await drivesAPI.requestCheckin(selectedDrive._id);
      setCheckInRequestedAt(response.data.checkInRequestedAt);
      setCheckinSentMessage(response.data.message);
    } catch (error) {
      setCheckinSentMessage(error.response?.data?.message || 'Failed to send check-in notification');
    } finally {
      setIsSendingCheckin(false);
      setTimeout(() => setCheckinSentMessage(''), 4000);
    }
  };

  // Leader toggles the full attendee list open/closed, lazy-fetching it on first open
  const handleToggleAttendeesList = async () => {
    if (showAttendeesList) {
      setShowAttendeesList(false);
      return;
    }
    setShowAttendeesList(true);
    if (attendeesData || isLoadingAttendees || !selectedDrive) return;
    setIsLoadingAttendees(true);
    setAttendeesError('');
    try {
      const response = await drivesAPI.getAttendees(selectedDrive._id);
      setAttendeesData(response.data);
    } catch (error) {
      setAttendeesError(error.response?.data?.message || 'Failed to load attendee list');
    } finally {
      setIsLoadingAttendees(false);
    }
  };

  // Member submits (or updates) their star rating for a completed drive
  const handleSubmitRating = async () => {
    if (!selectedDrive || isSubmittingRating || ratingStars === 0) return;
    setIsSubmittingRating(true);
    setRatingMessage('');
    try {
      await drivesAPI.submitRating(selectedDrive._id, ratingStars, ratingComment);
      trackEvent('RATING_SUBMITTED', { driveId: selectedDrive._id, stars: ratingStars });
      setRatingMessage('Thanks for rating this drive!');
      await fetchDriveRatings(selectedDrive._id);
    } catch (error) {
      setRatingMessage(error.response?.data?.message || 'Failed to submit rating');
    } finally {
      setIsSubmittingRating(false);
      setTimeout(() => setRatingMessage(''), 3000);
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
        trackEvent('RSVP_SUBMITTED', { driveId: selectedDrive._id, status });

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

  // Cancel Drive (UC-10) — distinct from Delete: sets isCancelled + notifies
  // members via SSE/email rather than removing the drive. Leader can cancel
  // any drive; a co-leader only drives they created themselves.
  const handleOpenCancelDrive = (drive) => {
    setDriveToCancel(drive);
    setCancelDriveReason('');
    setCancelDriveError('');
    setShowActionMenu(null);
  };

  const confirmCancelDrive = async () => {
    if (!driveToCancel) return;
    if (!cancelDriveReason.trim()) {
      setCancelDriveError('Please provide a reason for cancelling this drive');
      return;
    }
    try {
      const response = await drivesAPI.cancel(driveToCancel._id, cancelDriveReason.trim());
      if (response.data?.success) {
        setDrives(prevDrives => prevDrives.map(d => d._id === driveToCancel._id ? { ...d, isCancelled: true } : d));
        setDriveToCancel(null);
        setCancelDriveReason('');
      }
    } catch (error) {
      setCancelDriveError(error.response?.data?.message || 'Failed to cancel drive');
    }
  };

  const handleEditDrive = (drive) => {
    setEditFormData({
      name: drive.name,
      date: new Date(drive.date).toISOString().split('T')[0],
      time: drive.time || '',
      location: drive.location || '',
      coordinates: drive.coordinates || null,
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
      tags: club.tags || [],
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

  // Promote a regular member to co-leader (UC-10) — leader only
  const handlePromoteCoLeader = async (memberId) => {
    setCoLeaderActionError('');
    try {
      const response = await clubsAPI.promoteCoLeader(clubId, memberId);
      if (response.data?.success) {
        const promotedMember = club.members.find(m => (m._id?.toString() || m?.toString()) === memberId);
        setClub(prevClub => ({
          ...prevClub,
          coLeaders: [...(prevClub.coLeaders || []), promotedMember || memberId]
        }));
      }
    } catch (error) {
      setCoLeaderActionError(error.response?.data?.message || 'Failed to promote member');
    }
  };

  // Demote a co-leader back to a regular member (UC-10) — leader only
  const handleDemoteCoLeader = async (memberId) => {
    setCoLeaderActionError('');
    try {
      const response = await clubsAPI.demoteCoLeader(clubId, memberId);
      if (response.data?.success) {
        setClub(prevClub => ({
          ...prevClub,
          coLeaders: (prevClub.coLeaders || []).filter(c => (c._id?.toString() || c?.toString()) !== memberId)
        }));
      }
    } catch (error) {
      setCoLeaderActionError(error.response?.data?.message || 'Failed to demote co-leader');
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
          trackEvent('CLUB_JOINED', { clubId });
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

  // Leader or co-leader approves/rejects a pending join request (UC-10).
  // Refetches the whole club afterward since both `members` (on accept) and
  // `joinRequests` change together — the same pattern handleJoinClub already
  // uses for the public-club instant-join path above.
  const handleJoinRequestDecision = async (requestId, status) => {
    setPendingRequestError('');
    setProcessingRequestId(requestId);
    try {
      const response = await clubsAPI.handleJoinRequest(clubId, requestId, status);
      if (response.data?.success) {
        const refreshed = await clubsAPI.getClubById(clubId);
        if (refreshed.data?.success) setClub(refreshed.data.club);
      }
    } catch (error) {
      setPendingRequestError(error.response?.data?.message || 'Failed to process join request');
    } finally {
      setProcessingRequestId(null);
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

  // Schedule Drive: ScheduleDriveModal owns the form; this refetches the club's drive
  // list (shared `drives` state, also read by upcomingDrives/pastDrives below) and
  // closes the modal once the new drive has actually been created.
  const handleDriveScheduled = async () => {
    const drivesResponse = await drivesAPI.getClubDrives(clubId);
    if (drivesResponse.data?.success) setDrives(drivesResponse.data.drives || []);
    setShowScheduleDriveModal(false);
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (clubNotFound || !club) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6">
            <Users className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Club not found</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            This club doesn't exist or you may not have permission to view it.
            It may have been deleted or the link may be incorrect.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => navigate("/my-clubs")}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
            >
              My Clubs
            </button>
            <button
              onClick={() => navigate("/find-club")}
              className="flex-1 flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
            >
              Find a Club
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <div id="main-content" role="main" className="flex-1 min-w-0 max-w-4xl min-h-screen p-4 lg:p-6 xl:p-8">
          {/* Back button */}
          <button
            onClick={() => navigate("/my-clubs")}
            className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white mb-5 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to My Clubs
          </button>

          {/* Club hero header */}
          <div className="relative overflow-hidden glass-card p-5 mb-6 rounded-3xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500/8 to-orange-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/[0.10] shrink-0">
                {club.avatar ? (
                  <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-orange-600">
                    <span className="text-white text-2xl font-bold">{club.name?.charAt(0)?.toUpperCase?.()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white leading-tight">{club.name}</h1>
                {club.description && <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{club.description}</p>}
                {club.location && (
                  <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{club.location}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pending Join Requests — leader or co-leader, private clubs only (UC-10). Lives in the
              main content column, not the right sidebar — that sidebar is height-capped with
              overflow-hidden at desktop widths, so new sidebar content silently clips once enough
              other cards (a scheduled drive, Manage Club, Members) already fill it. */}
          {canModerate && club.isPrivate && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Pending Join Requests</h3>
                    <p className="text-xs text-zinc-400">Members waiting for approval</p>
                  </div>
                </div>
                {pendingJoinRequests.length > 0 && (
                  <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{pendingJoinRequests.length}</span>
                )}
              </div>
              {pendingRequestError && (
                <p className="text-red-400 text-xs mb-2">{pendingRequestError}</p>
              )}
              {pendingJoinRequests.length === 0 ? (
                <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-2xl p-6 text-center">
                  <p className="text-zinc-400 text-sm">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingJoinRequests.map((request) => (
                    <div key={request._id} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl px-4 py-3">
                      <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {request.user?.avatar ? (
                          <img src={request.user.avatar} alt={request.user.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-zinc-400 text-xs">{request.user?.username?.charAt(0)?.toUpperCase?.()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {request.user?.useDisplayName && request.user?.name ? request.user.name : request.user?.username}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">@{request.user?.username}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleJoinRequestDecision(request._id, 'accepted')}
                          disabled={processingRequestId === request._id}
                          className="p-1.5 text-zinc-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-all disabled:opacity-50"
                          title="Approve"
                        >
                          <UserCheck size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleJoinRequestDecision(request._id, 'rejected')}
                          disabled={processingRequestId === request._id}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                          title="Reject"
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Next Upcoming Drive - only shown when drives exist */}
          {upcomingDrives.length > 0 && (
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
                      <p className="text-xs text-zinc-400">Don't miss out on the upcoming event</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Drive Card */}
              <div
                role={isMember || isLeader ? 'button' : undefined}
                tabIndex={isMember || isLeader ? 0 : undefined}
                className={`glass-card p-4 transition-all duration-200 group rounded-2xl ${isMember || isLeader ? 'cursor-pointer hover:border-white/[0.12] hover:-translate-y-0.5' : 'cursor-default opacity-70'}`}
                onClick={() => (isMember || isLeader) && handleDriveClick(upcomingDrives[0])}
                onKeyDown={(e) => {
                  if ((isMember || isLeader) && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleDriveClick(upcomingDrives[0]);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white group-hover:text-red-400 transition-colors mb-1.5">
                      {upcomingDrives[0].name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(upcomingDrives[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {upcomingDrives[0].time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {upcomingDrives[0].time}
                        </span>
                      )}
                      {upcomingDrives[0].location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[140px]">{upcomingDrives[0].location}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {driveRSVPCounts[upcomingDrives[0]?._id]?.failed ? (
                          <span className="text-amber-400" title="Couldn't load attendee count">
                            — going
                          </span>
                        ) : (
                          <>{driveRSVPCounts[upcomingDrives[0]?._id]?.going ?? 0} going</>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Report drive */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setReportTarget({ type: 'drive', id: upcomingDrives[0]._id, name: upcomingDrives[0].name }); }}
                      className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
                      title="Report drive"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-8 h-8 bg-white/[0.04] group-hover:bg-red-500/15 rounded-xl flex items-center justify-center transition-all">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-red-400" />
                    </div>
                  </div>
                </div>
              </div>

              {upcomingDrives.length > 1 && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="bg-zinc-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-700/30">
                    <p className="text-zinc-400 text-sm">
                      +{upcomingDrives.length - 1} more upcoming drive{upcomingDrives.length > 2 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Announcements Section — visible to all on public clubs, members/leader/co-leader only on private clubs */}
          {(!club.isPrivate || isMember || isLeader) && (
            <AnnouncementsSection
              clubId={clubId}
              announcements={announcements}
              setAnnouncements={setAnnouncements}
              canModerate={canModerate}
            />
          )}
        </div>

        <MobileDrawerButton onClick={() => setMobileInfoOpen(true)} breakpointClass="lg:hidden" side="right" label="club info" />

        <div
          className={
            mobileInfoOpen
              ? "flex fixed inset-0 z-50 bg-zinc-950 flex-col p-5 pt-16 overflow-y-auto lg:inset-auto lg:z-auto lg:bg-transparent lg:flex-none lg:w-56 xl:w-72 2xl:w-80 lg:p-3 xl:p-5 2xl:p-6 lg:pt-3 xl:pt-5 2xl:pt-6 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-hidden"
              : "hidden lg:flex lg:flex-col lg:flex-none lg:w-56 xl:w-72 2xl:w-80 lg:p-3 xl:p-5 2xl:p-6 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-hidden"
          }
        >
          {mobileInfoOpen && (
            <button
              type="button"
              onClick={() => setMobileInfoOpen(false)}
              aria-label="Close club info"
              className="lg:hidden absolute top-4 right-4 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">Club Info</h3>

          <div className="bg-zinc-900 rounded-xl xl:rounded-2xl p-3 xl:p-4 space-y-2 xl:space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Leader</p>
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
                <p className="text-zinc-400 text-sm">No drives scheduled yet</p>
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
                        <button
                          type="button"
                          disabled={!(isMember || isLeader)}
                          className={`flex-1 text-left ${isMember || isLeader ? 'cursor-pointer' : 'cursor-default'}`}
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
                        </button>
                        {(() => {
                          const driveCreatorId = drive.createdBy?._id?.toString() || drive.createdBy?.toString() || '';
                          const canCancelThisDrive = isLeader || (isCoLeader && driveCreatorId === userId);
                          if (!isLeader && !canCancelThisDrive) return null;
                          return (
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
                                  {isLeader && (
                                    <button
                                      onClick={() => handleEditDrive(drive)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 flex items-center gap-2 rounded-t-xl transition"
                                    >
                                      <Edit3 size={14} />
                                      Edit
                                    </button>
                                  )}
                                  {isLeader && (
                                    <button
                                      onClick={() => handleMarkComplete(drive)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 flex items-center gap-2 transition"
                                    >
                                      <CheckCircle size={14} />
                                      Mark Complete
                                    </button>
                                  )}
                                  {canCancelThisDrive && (
                                    <button
                                      onClick={() => handleOpenCancelDrive(drive)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 flex items-center gap-2 transition"
                                    >
                                      <X size={14} />
                                      Cancel Drive
                                    </button>
                                  )}
                                  {isLeader && (
                                    <button
                                      onClick={() => handleDeleteDrive(drive)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-red-900/50 text-red-400 flex items-center gap-2 rounded-b-xl transition"
                                    >
                                      <Trash2 size={14} />
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                      className="flex-1 text-zinc-400 hover:text-zinc-400 text-sm font-medium transition py-2 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-700/30"
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
            {canModerate && (
              <button
                onClick={() => setShowScheduleDriveModal(true)}
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
                    <p className="text-xs xl:text-sm text-zinc-400">Members</p>
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
                  <p className="text-sm text-center text-zinc-400">
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
                        placeholder=""
                        aria-label="Find users to invite"
                        className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                      />
                      <Search className="absolute right-3 top-2.5 text-zinc-400 w-4 h-4" />
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
          <div role="dialog" aria-modal="true" aria-labelledby="all-drives-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 id="all-drives-modal-title" className="text-2xl font-bold">All Drives & Events</h2>
              <button
                type="button"
                onClick={closeAllDrivesModal}
                aria-label="Dismiss drives list"
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {filteredAndSortedDrives.map((drive) => (
                <button
                  type="button"
                  key={drive._id}
                  onClick={() => {
                    handleDriveClick(drive);
                    closeAllDrivesModal();
                  }}
                  className="w-full text-left bg-black rounded-2xl p-4 cursor-pointer hover:bg-zinc-800 transition"
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
                </button>
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
          <div role="dialog" aria-modal="true" aria-labelledby="members-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 id="members-modal-title" className="text-2xl font-bold">All Members ({club.members?.length || 0})</h2>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                aria-label="Dismiss members list"
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            {coLeaderActionError && (
              <p className="text-red-400 text-xs mb-3">{coLeaderActionError}</p>
            )}

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {(club.members || []).map((member) => {
                const memberIsLeader = club.leader?._id && member._id === club.leader._id;
                const memberIsCoLeader = (club.coLeaders || []).some(
                  c => (c._id?.toString() || c?.toString()) === member._id?.toString()
                );
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
                          <span className="text-zinc-400 text-sm">
                            {member.username?.charAt(0)?.toUpperCase?.()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-medium">
                        {member.useDisplayName && member.name ? member.name : member.username}
                      </p>
                      <p className="text-sm text-zinc-400">@{member.username}</p>
                      {(() => {
                        const primaryCar = member.cars?.find(c => c.isPrimary) || member.cars?.[0];
                        return primaryCar && (primaryCar.year || primaryCar.make || primaryCar.model) && (
                          <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
                            {primaryCar.year} {primaryCar.make} {primaryCar.model}
                          </p>
                        );
                      })()}
                    </div>

                    {memberIsLeader ? (
                      <span className="text-amber-500 text-sm flex items-center gap-1 bg-amber-900/30 px-3 py-1 rounded-full">
                        <Crown size={12} /> Leader
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {/* Co-Leader badge (UC-10) */}
                        {memberIsCoLeader && (
                          <span className="text-sky-400 text-sm flex items-center gap-1 bg-sky-900/30 px-3 py-1 rounded-full">
                            <Shield size={12} /> Co-Leader
                          </span>
                        )}
                        {/* Report button — visible to any member for other members */}
                        {member._id !== user?._id && (
                          <button
                            type="button"
                            onClick={() => setReportTarget({ type: 'user', id: member._id, name: `@${member.username}` })}
                            className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
                            title="Report member"
                          >
                            <Flag size={14} />
                          </button>
                        )}
                        {/* Promote/Demote co-leader — leader only (UC-10) */}
                        {isLeader && !memberIsCoLeader && (
                          <button
                            type="button"
                            onClick={() => handlePromoteCoLeader(member._id)}
                            className="p-1.5 text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all"
                            title="Promote to co-leader"
                          >
                            <Shield size={14} />
                          </button>
                        )}
                        {isLeader && memberIsCoLeader && (
                          <button
                            type="button"
                            onClick={() => handleDemoteCoLeader(member._id)}
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                            title="Demote to member"
                          >
                            <ShieldOff size={14} />
                          </button>
                        )}
                        {/* Remove button — leader or co-leader; a co-leader can't remove another co-leader */}
                        {canModerate && (isLeader || !memberIsCoLeader) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member._id, member.username)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Remove from club"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )}
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
          <div role="dialog" aria-modal="true" aria-labelledby="past-events-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 id="past-events-modal-title" className="text-2xl font-bold">Past Events</h2>
              <button
                type="button"
                onClick={() => setShowPastEventsModal(false)}
                aria-label="Dismiss past drives list"
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {pastDrives.map((drive) => (
                <button
                  type="button"
                  key={drive._id}
                  disabled={!(isMember || isLeader)}
                  onClick={() => {
                    if (!(isMember || isLeader)) return;
                    handleDriveClick(drive);
                    setShowPastEventsModal(false);
                  }}
                  className={`w-full text-left bg-black rounded-2xl p-4 transition ${isMember || isLeader ? 'cursor-pointer hover:bg-zinc-800' : 'cursor-default opacity-80'}`}
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
                </button>
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
          <div role="dialog" aria-modal="true" aria-labelledby="edit-drive-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 id="edit-drive-modal-title" className="text-2xl font-bold">Edit Drive</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedDrive(null);
                }}
                aria-label="Dismiss drive editor"
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-drive-name" className="block text-sm text-zinc-400 mb-2">Name</label>
                <input
                  id="edit-drive-name"
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="edit-drive-date" className="block text-sm text-zinc-400 mb-2">Date</label>
                <input
                  id="edit-drive-date"
                  type="date"
                  value={editFormData.date || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="edit-drive-time" className="block text-sm text-zinc-400 mb-2">Time</label>
                <input
                  id="edit-drive-time"
                  type="text"
                  value={editFormData.time || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                  placeholder="e.g., 10:00 AM"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="edit-drive-location" className="block text-sm text-zinc-400 mb-2">Location</label>
                <LocationSearch
                  id="edit-drive-location"
                  value={editFormData.location || ''}
                  onChange={(v) => setEditFormData({ ...editFormData, location: v })}
                  onSelect={({ lat, lng }) => setEditFormData({ ...editFormData, coordinates: { lat, lng } })}
                />
                {editFormData.coordinates?.lat && (
                  <div className="mt-3 space-y-1">
                    <DriveMapPicker
                      lat={editFormData.coordinates.lat}
                      lng={editFormData.coordinates.lng}
                      onChange={(coords) => setEditFormData({ ...editFormData, coordinates: coords })}
                    />
                    <p className="text-[11px] text-zinc-400">Drag the pin to fine-tune the exact meeting point.</p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="edit-drive-description" className="block text-sm text-zinc-400 mb-2">Description</label>
                <textarea
                  id="edit-drive-description"
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
        <DriveDetailModal
          drive={selectedDrive}
          isMember={isMember}
          canModerate={canModerate}
          onClose={closeDriveModal}
          rsvp={{
            status: userRSVP,
            waitlistPosition: userWaitlistPosition,
            counts: rsvpCounts,
            isLoading: isRSVPLoading,
            message: rsvpMessage,
            onSubmit: handleRSVP,
          }}
          checkin={{
            counts: checkinCounts,
            requestedAt: checkInRequestedAt,
            isSending: isSendingCheckin,
            sentMessage: checkinSentMessage,
            onSend: handleSendCheckin,
          }}
          attendees={{
            show: showAttendeesList,
            data: attendeesData,
            isLoading: isLoadingAttendees,
            error: attendeesError,
            onToggle: handleToggleAttendeesList,
          }}
          rating={{
            summary: driveRatingSummary,
            stars: ratingStars,
            hoverStars: ratingHoverStars,
            setStars: setRatingStars,
            setHoverStars: setRatingHoverStars,
            comment: ratingComment,
            setComment: setRatingComment,
            onSubmit: handleSubmitRating,
            isSubmitting: isSubmittingRating,
            message: ratingMessage,
          }}
        />
      )}

      {/* Club Edit Modal */}
      {showClubEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-club-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 id="edit-club-modal-title" className="text-2xl font-bold">Edit Club</h2>
              <button
                type="button"
                onClick={closeClubEditModal}
                aria-label="Dismiss club editor"
                className="text-zinc-400 hover:text-white transition"
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
                <p className="block text-sm text-zinc-400 mb-2">Club Avatar</p>
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
                        <span className="text-zinc-400 text-xs">No Image</span>
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
                    <p className="text-xs text-zinc-400">Selected: {avatarFileName}</p>
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
                <LocationSearch
                  id="club-edit-location"
                  value={clubEditFormData.location || ''}
                  onChange={(val) => setClubEditFormData({ ...clubEditFormData, location: val })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-zinc-400">Club Tags</p>
                  <span className="text-xs text-zinc-400">{(clubEditFormData.tags || []).length}/5 selected</span>
                </div>
                <ClubTagPicker
                  selected={clubEditFormData.tags || []}
                  onChange={(tags) => setClubEditFormData({ ...clubEditFormData, tags })}
                  max={5}
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
                          <p className="text-xs text-zinc-400">@{member.username}</p>
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
        <ScheduleDriveModal
          clubId={clubId}
          onClose={() => setShowScheduleDriveModal(false)}
          onScheduled={handleDriveScheduled}
        />
      )}

      {/* Leave Club Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="leave-club-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 id="leave-club-modal-title" className="text-2xl font-bold">Leave Club</h2>
              <button
                type="button"
                onClick={cancelLeaveClub}
                aria-label="Dismiss leave-club confirmation"
                className="text-zinc-400 hover:text-white transition"
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
          <div role="dialog" aria-modal="true" aria-labelledby="delete-drive-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-2xl">
            <h3 id="delete-drive-modal-title" className="text-lg font-bold mb-2">Delete Drive</h3>
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

      {/* Cancel Drive Confirmation (UC-10) — distinct from Delete: notifies members */}
      {driveToCancel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-drive-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-2xl">
            <h3 id="cancel-drive-modal-title" className="text-lg font-bold mb-2">Cancel Drive</h3>
            <p className="text-zinc-400 text-sm mb-3">
              Cancelling <span className="text-white font-medium">{driveToCancel.name}</span> will notify every member who RSVPed. This cannot be undone.
            </p>
            <label htmlFor="cancel-drive-reason" className="block text-sm text-zinc-400 mb-2">Reason</label>
            <textarea
              id="cancel-drive-reason"
              value={cancelDriveReason}
              onChange={(e) => { setCancelDriveReason(e.target.value); setCancelDriveError(''); }}
              rows={3}
              placeholder="e.g. Bad weather in the forecast"
              className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none mb-3"
            />
            {cancelDriveError && (
              <p className="text-red-400 text-sm mb-3">{cancelDriveError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDriveToCancel(null); setCancelDriveError(''); }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition"
              >
                Keep Drive
              </button>
              <button
                type="button"
                onClick={confirmCancelDrive}
                className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition"
              >
                Cancel Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="remove-member-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-2xl">
            <h3 id="remove-member-modal-title" className="text-lg font-bold mb-2">Remove Member</h3>
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
          <div role="dialog" aria-modal="true" aria-labelledby="delete-club-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-red-600 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 id="delete-club-modal-title" className="text-2xl font-bold text-red-400">Delete Club</h2>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteEmail('');
                  setDeleteReason('');
                }}
                aria-label="Dismiss club deletion form"
                className="text-zinc-400 hover:text-white transition"
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
                <label htmlFor="delete-club-email" className="block text-sm text-zinc-400 mb-2">
                  Confirm Leader Email
                  <span className="text-zinc-400 text-xs ml-1">(Must match the club leader's email)</span>
                </label>
                <input
                  id="delete-club-email"
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder="leader@example.com"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="delete-club-reason" className="block text-sm text-zinc-400 mb-2">
                  Reason for Deletion
                  <span className="text-zinc-400 text-xs ml-1">(Optional, helps us improve)</span>
                </label>
                <textarea
                  id="delete-club-reason"
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

      {/* Report modal */}
      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};

export default ClubDetail;

