const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authentication');
const { apiLimiter } = require('../middleware/rateLimiters');
const { validateParams, validateInput, validateQuery } = require('../middleware/validation');
const { MAX_SEARCH_RADIUS_MILES } = require('../utils/geo');
const {
  createDrive,
  getClubDrives,
  rsvpToDrive,
  cancelDrive,
  cancelDriveSeries,
  updateDrive,
  deleteDrive,
  getDriveAttendees,
  getDriveRSVPStatus,
  getLeaderDashboard,
  getMyRSVPs,
  getClubAnalytics,
  requestCheckin,
  getCheckinStatus,
  submitCheckin,
  submitRating,
  getDriveRatings,
  getCalendarDrives,
  exportDriveIcs,
  exportMyScheduleIcs,
  addDrivePhotos,
  removeDrivePhoto,
  getNearbyDrives
} = require('../controllers/driveController');

// All routes require authentication
router.use(protect);
router.use(apiLimiter);

/**
 * @route   POST /api/drives
 * @desc    Create a new drive/event
 * @access  Private (Club Leaders only)
 */
router.post(
  '/',
  validateInput({
    clubId: { required: true, type: 'string' },
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    date: { required: true, type: 'string' },
    time: { required: true, type: 'string', maxLength: 20 },
    // IANA zone the drive happens in; controllers validate it and default
    // to DEFAULT_TIME_ZONE (utils/driveTime.js) when it's omitted
    timeZone: { type: 'string', maxLength: 64 },
    location: { required: true, type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    maxAttendees: { type: 'number', min: 1, max: 1000 },
    // Recurring drive series (UC-11) — optional; materializes `count`
    // occurrences as real Drive documents sharing one recurrence.groupId.
    repeat: {
      type: 'object',
      custom: (value) => {
        if (!value) return null;
        if (!['weekly', 'biweekly', 'monthly'].includes(value.frequency)) {
          return 'repeat.frequency must be one of: weekly, biweekly, monthly';
        }
        if (!Number.isInteger(value.count) || value.count < 2 || value.count > 12) {
          return 'repeat.count must be an integer between 2 and 12';
        }
        return null;
      }
    }
  }),
  createDrive
);

/**
 * @route   GET /api/drives/dashboard
 * @desc    Get leader dashboard with all clubs and drives
 * @access  Private (Club Leaders only)
 */
router.get('/dashboard', getLeaderDashboard);

/**
 * @route   GET /api/drives/my-rsvps
 * @desc    Get current user's RSVP history across all clubs
 * @access  Private
 */
router.get('/my-rsvps', getMyRSVPs);

/**
 * @route   GET /api/drives/my-rsvps/export.ics
 * @desc    Export the current user's upcoming going/maybe drives as an iCalendar file (UC-33)
 * @access  Private
 * @note    Must stay registered before /:driveId routes — Express matches by
 *          registration order, and /:driveId/export.ics would otherwise
 *          swallow this fixed-segment path with driveId="my-rsvps".
 */
router.get('/my-rsvps/export.ics', exportMyScheduleIcs);

/**
 * @route   GET /api/drives/analytics
 * @desc    Get club analytics summary for all clubs the user leads
 * @access  Private (Club Leaders only)
 */
router.get('/analytics', getClubAnalytics);

/**
 * @route   GET /api/drives/calendar
 * @desc    Get all drives across the user's clubs within a given month, for calendar display
 * @access  Private
 */
router.get(
  '/calendar',
  validateQuery({
    year: { required: true, type: 'number', min: 2000, max: 2100 },
    month: { required: true, type: 'number', min: 1, max: 12 }
  }),
  getCalendarDrives
);

/**
 * @route   GET /api/drives/nearby
 * @desc    Upcoming drives within `radius` miles of lat/lng, from public clubs + the user's own (UC-46)
 * @access  Private
 */
router.get(
  '/nearby',
  validateQuery({
    lat: { required: true, type: 'number', min: -90, max: 90 },
    lng: { required: true, type: 'number', min: -180, max: 180 },
    radius: { type: 'number', min: 1, max: MAX_SEARCH_RADIUS_MILES },
    limit: { type: 'number', min: 1, max: 50 }
  }),
  getNearbyDrives
);

/**
 * @route   GET /api/drives/club/:clubId
 * @desc    Get all drives for a specific club
 * @access  Private
 */
router.get(
  '/club/:clubId',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  getClubDrives
);

/**
 * @route   GET /api/drives/:driveId/rsvp-status
 * @desc    Get RSVP counts + current user's RSVP status for a drive
 * @access  Private (any club member)
 */
router.get(
  '/:driveId/rsvp-status',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  getDriveRSVPStatus
);

/**
 * @route   GET /api/drives/:driveId/export.ics
 * @desc    Export a single drive as an iCalendar file (UC-33)
 * @access  Private (any club member)
 */
router.get(
  '/:driveId/export.ics',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  exportDriveIcs
);

/**
 * @route   GET /api/drives/:driveId/attendees
 * @desc    Get drive attendees and stats
 * @access  Private (Club Leaders only)
 */
router.get(
  '/:driveId/attendees',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  getDriveAttendees
);

/**
 * @route   POST /api/drives/:driveId/rsvp
 * @desc    RSVP to a drive
 * @access  Private
 */
router.post(
  '/:driveId/rsvp',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  validateInput({
    status: { required: true, type: 'string', enum: ['going', 'maybe', 'not-going'] }
  }),
  rsvpToDrive
);

/**
 * @route   POST /api/drives/:driveId/cancel
 * @desc    Cancel a drive
 * @access  Private (Club Leaders only)
 */
router.post(
  '/:driveId/cancel',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  validateInput({
    cancellationReason: { required: true, type: 'string', minLength: 10, maxLength: 500 }
  }),
  cancelDrive
);

/**
 * @route   POST /api/drives/series/:groupId/cancel
 * @desc    Cancel all remaining (future, uncancelled) occurrences of a recurring series (UC-11)
 * @access  Private (Club Leader only)
 */
router.post(
  '/series/:groupId/cancel',
  validateParams({
    groupId: { required: true, objectId: true }
  }),
  validateInput({
    cancellationReason: { required: true, type: 'string', minLength: 10, maxLength: 500 }
  }),
  cancelDriveSeries
);

/**
 * @route   PUT /api/drives/:driveId
 * @desc    Update a drive (edit details or mark as complete)
 * @access  Private (Club Leaders only)
 */
router.put(
  '/:driveId',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  validateInput({
    name: { type: 'string', minLength: 1, maxLength: 100 },
    date: { type: 'string' },
    time: { type: 'string', maxLength: 20 },
    timeZone: { type: 'string', maxLength: 64 },
    location: { type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    maxAttendees: { type: 'number', min: 1, max: 1000 },
    isCompleted: { type: 'boolean' }
  }),
  updateDrive
);

/**
 * @route   DELETE /api/drives/:driveId
 * @desc    Delete a drive
 * @access  Private (Club Leaders only)
 */
router.delete(
  '/:driveId',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  deleteDrive
);

/**
 * @route   POST /api/drives/:driveId/request-checkin
 * @desc    Notify "going" members that check-in is open (resendable until drive is completed)
 * @access  Private (Club Leaders only)
 */
router.post(
  '/:driveId/request-checkin',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  requestCheckin
);

/**
 * @route   GET /api/drives/:driveId/checkin-status
 * @desc    Get the requesting user's check-in status for a drive
 * @access  Private (members with a 'going' RSVP)
 */
router.get(
  '/:driveId/checkin-status',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  getCheckinStatus
);

/**
 * @route   POST /api/drives/:driveId/checkin
 * @desc    Mark self as present or not-present for a drive
 * @access  Private (members with a 'going' RSVP)
 */
router.post(
  '/:driveId/checkin',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  validateInput({
    present: { required: true, type: 'boolean' }
  }),
  submitCheckin
);

/**
 * @route   POST /api/drives/:driveId/ratings
 * @desc    Submit or update a star rating + optional comment for a completed drive
 * @access  Private (members with a 'going' RSVP, only after the drive is completed)
 */
router.post(
  '/:driveId/ratings',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  validateInput({
    stars: { required: true, type: 'number', min: 1, max: 5 },
    comment: { type: 'string', maxLength: 200 }
  }),
  submitRating
);

/**
 * @route   GET /api/drives/:driveId/ratings
 * @desc    Get all ratings for a drive, average/count, and the requester's own rating
 * @access  Private (any member of the drive's club)
 */
router.get(
  '/:driveId/ratings',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  getDriveRatings
);

/**
 * @route   POST /api/drives/:driveId/photos
 * @desc    Add photos to a completed drive's gallery (UC-5)
 * @access  Private (Club Leaders only)
 */
router.post(
  '/:driveId/photos',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  validateInput({
    photos: {
      required: true,
      type: 'array',
      custom: (value) => {
        if (!Array.isArray(value)) return 'photos must be an array';
        if (value.length < 1) return 'At least one photo is required';
        if (value.length > 12) return 'You can add at most 12 photos at once';
        if (value.some(p => typeof p !== 'string' || p.length === 0 || p.length > 300000)) {
          return 'Invalid photo';
        }
        return null;
      }
    }
  }),
  addDrivePhotos
);

/**
 * @route   DELETE /api/drives/:driveId/photos/:index
 * @desc    Remove a single photo from a drive's gallery (UC-5)
 * @access  Private (Club Leaders only)
 */
router.delete(
  '/:driveId/photos/:index',
  validateParams({
    driveId: { required: true, objectId: true }
  }),
  removeDrivePhoto
);

module.exports = router;
