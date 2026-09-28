import { useState } from 'react';
import { drivesAPI } from '../services/api';
import { trackEvent } from '../services/analytics';
import { compressImage } from '../utils/imageCompressor';
import { useDriveRsvp } from './useDriveRsvp';

const EMPTY_RSVP_COUNTS = { going: 0, maybe: 0, notGoing: 0, waitlisted: 0 };
const EMPTY_CHECKIN_COUNTS = { present: 0, notPresent: 0, pending: 0 };
const EMPTY_RATING_SUMMARY = { average: null, count: 0 };

// Show a transient message, then clear it after `ms`
const flash = (setMessage, text, ms) => {
  setMessage(text);
  setTimeout(() => setMessage(''), ms);
};

/**
 * Everything behind ClubDetail's drive detail modal: which drive is open,
 * the viewer's RSVP (UC-03 waitlist aware), check-in (UC-08), the leader's
 * attendee list, ratings (UC-25), and the photo gallery (UC-5). All of it
 * is modal-scoped and reset by close().
 *
 * The returned `modalProps` are shaped for DriveDetailModal's grouped props.
 *
 * @param {object} callbacks
 * @param {(driveId, counts) => void} callbacks.onRsvpCounts - fresh RSVP
 *   counts for a drive, so the page's drive cards stay current after close
 * @param {(driveId, photos) => void} callbacks.onPhotosChanged - the drive's
 *   new photo list, so the page's copy survives closing/reopening the modal
 */
export const useDriveDetail = ({ onRsvpCounts, onPhotosChanged }) => {
  const [drive, setDrive] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // RSVP
  const [userRSVP, setUserRSVP] = useState(null); // 'going', 'maybe', 'not-going', 'waitlisted', or null
  const [userWaitlistPosition, setUserWaitlistPosition] = useState(null);
  const [rsvpCounts, setRsvpCounts] = useState(EMPTY_RSVP_COUNTS);
  const { isSubmitting: isRSVPLoading, submitRsvp } = useDriveRsvp();
  const [rsvpMessage, setRsvpMessage] = useState('');

  // Check-in
  const [checkinCounts, setCheckinCounts] = useState(EMPTY_CHECKIN_COUNTS);
  const [checkInRequestedAt, setCheckInRequestedAt] = useState(null);
  const [isSendingCheckin, setIsSendingCheckin] = useState(false);
  const [checkinSentMessage, setCheckinSentMessage] = useState('');

  // Attendee list (leader/co-leader only, lazy-loaded on first open)
  const [showAttendeesList, setShowAttendeesList] = useState(false);
  const [attendeesData, setAttendeesData] = useState(null); // { rsvps, stats } from GET /drives/:id/attendees
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeesError, setAttendeesError] = useState('');

  // Rating
  const [driveRatingSummary, setDriveRatingSummary] = useState(EMPTY_RATING_SUMMARY);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingHoverStars, setRatingHoverStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingMessage, setRatingMessage] = useState('');

  // Photo gallery
  const [isUploadingDrivePhotos, setIsUploadingDrivePhotos] = useState(false);
  const [drivePhotosError, setDrivePhotosError] = useState('');

  // Counts + the viewer's own status, via /rsvp-status (open to all members).
  // Also reports the counts upward so the drive cards reflect them after close.
  const fetchRsvpData = async (driveId) => {
    try {
      const response = await drivesAPI.getRSVPStatus(driveId);
      if (!response.data?.success) return;
      const counts = {
        going:      response.data.counts.going,
        maybe:      response.data.counts.maybe,
        notGoing:   response.data.counts.notGoing,
        waitlisted: response.data.counts.waitlisted ?? 0,
      };
      setRsvpCounts(counts);
      onRsvpCounts(driveId, counts);
      setUserRSVP(response.data.userStatus);
      setUserWaitlistPosition(response.data.waitlistPosition ?? null);
      if (response.data.checkin) {
        setCheckinCounts({
          present: response.data.checkin.present,
          notPresent: response.data.checkin.notPresent,
          pending: response.data.checkin.pending,
        });
      }
      setCheckInRequestedAt(response.data.checkInRequestedAt ?? null);
    } catch (error) {
      console.error('Error fetching RSVP data:', error);
    }
  };

  // The average rating + the viewer's own rating (if any) for a completed drive
  const fetchRatings = async (driveId) => {
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

  // Load the drive's data first, then show the modal already filled in
  const open = async (nextDrive) => {
    setDrive(nextDrive);
    await fetchRsvpData(nextDrive._id);
    if (nextDrive.isCompleted) {
      await fetchRatings(nextDrive._id);
    }
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setDrive(null);
    setUserRSVP(null);
    setUserWaitlistPosition(null);
    setRsvpCounts(EMPTY_RSVP_COUNTS);
    setRsvpMessage('');
    setCheckinCounts(EMPTY_CHECKIN_COUNTS);
    setCheckInRequestedAt(null);
    setCheckinSentMessage('');
    setShowAttendeesList(false);
    setAttendeesData(null);
    setAttendeesError('');
    setDriveRatingSummary(EMPTY_RATING_SUMMARY);
    setRatingStars(0);
    setRatingHoverStars(0);
    setRatingComment('');
    setRatingMessage('');
    setDrivePhotosError('');
  };

  // Submit-then-reconcile sequencing (never trust the requested status as
  // final — a full drive can silently waitlist instead) lives in
  // useDriveRsvp, shared with Calendar.jsx; fetchRsvpData is the reconcile
  // step since it also refreshes check-in counts and the page's card counts.
  const handleRSVP = async (status) => {
    if (isRSVPLoading) return;
    setRsvpMessage('');
    try {
      // The reconcile step has already set userRSVP to the server's
      // resulting status by the time this resolves — don't also set it from
      // the requested `status`, which could overwrite a correct 'waitlisted'
      // with the 'going' the user merely asked for (Invariant #5).
      const data = await submitRsvp(drive._id, status, () => fetchRsvpData(drive._id));
      if (data?.success) flash(setRsvpMessage, data.message, 3000);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      flash(setRsvpMessage, error.response?.data?.message || 'Failed to submit RSVP', 3000);
    }
  };

  // Leader sends (or resends) the check-in notification to all "going" members
  const handleSendCheckin = async () => {
    if (!drive || isSendingCheckin) return;
    setIsSendingCheckin(true);
    setCheckinSentMessage('');
    try {
      const response = await drivesAPI.requestCheckin(drive._id);
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
    if (attendeesData || isLoadingAttendees || !drive) return;
    setIsLoadingAttendees(true);
    setAttendeesError('');
    try {
      const response = await drivesAPI.getAttendees(drive._id);
      setAttendeesData(response.data);
    } catch (error) {
      setAttendeesError(error.response?.data?.message || 'Failed to load attendee list');
    } finally {
      setIsLoadingAttendees(false);
    }
  };

  // Member submits (or updates) their star rating for a completed drive
  const handleSubmitRating = async () => {
    if (!drive || isSubmittingRating || ratingStars === 0) return;
    setIsSubmittingRating(true);
    setRatingMessage('');
    try {
      await drivesAPI.submitRating(drive._id, ratingStars, ratingComment);
      trackEvent('RATING_SUBMITTED', { driveId: drive._id, stars: ratingStars });
      setRatingMessage('Thanks for rating this drive!');
      await fetchRatings(drive._id);
    } catch (error) {
      setRatingMessage(error.response?.data?.message || 'Failed to submit rating');
    } finally {
      setIsSubmittingRating(false);
      setTimeout(() => setRatingMessage(''), 3000);
    }
  };

  const applyPhotos = (driveId, photos) => {
    setDrive((prev) => (prev && prev._id === driveId ? { ...prev, photos } : prev));
    onPhotosChanged(driveId, photos);
  };

  // Leader/co-leader adds photos to a completed drive's gallery (UC-5).
  // Compressed like avatar/car-photo uploads, at a larger size to keep more
  // detail in the gallery.
  const handleAddDrivePhotos = async (files) => {
    if (!drive || !files || files.length === 0) return;
    setIsUploadingDrivePhotos(true);
    setDrivePhotosError('');
    try {
      const compressed = await Promise.all(
        Array.from(files).map((file) => compressImage(file, 800, 800))
      );
      const response = await drivesAPI.addPhotos(drive._id, compressed.map((r) => r.compressedData));
      if (response.data?.success) applyPhotos(drive._id, response.data.photos);
    } catch (error) {
      setDrivePhotosError(error.response?.data?.message || 'Failed to add photos.');
    } finally {
      setIsUploadingDrivePhotos(false);
    }
  };

  // Leader/co-leader removes a single photo (e.g. undo a mistaken upload)
  const handleRemoveDrivePhoto = async (index) => {
    if (!drive) return;
    setDrivePhotosError('');
    try {
      const response = await drivesAPI.removePhoto(drive._id, index);
      if (response.data?.success) applyPhotos(drive._id, response.data.photos);
    } catch (error) {
      setDrivePhotosError(error.response?.data?.message || 'Failed to remove photo.');
    }
  };

  return {
    drive,
    isOpen: isOpen && Boolean(drive),
    open,
    close,
    modalProps: {
      rsvp: {
        status: userRSVP,
        waitlistPosition: userWaitlistPosition,
        counts: rsvpCounts,
        isLoading: isRSVPLoading,
        message: rsvpMessage,
        onSubmit: handleRSVP,
      },
      checkin: {
        counts: checkinCounts,
        requestedAt: checkInRequestedAt,
        isSending: isSendingCheckin,
        sentMessage: checkinSentMessage,
        onSend: handleSendCheckin,
      },
      attendees: {
        show: showAttendeesList,
        data: attendeesData,
        isLoading: isLoadingAttendees,
        error: attendeesError,
        onToggle: handleToggleAttendeesList,
      },
      rating: {
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
      },
      photos: {
        isUploading: isUploadingDrivePhotos,
        error: drivePhotosError,
        onAdd: handleAddDrivePhotos,
        onRemove: handleRemoveDrivePhoto,
      },
    },
  };
};
