const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authentication');
const { apiLimiter } = require('../middleware/rateLimiters');
const { validateParams, validateInput, validateQuery } = require('../middleware/validation');
const {
  createDrive,
  getClubDrives,
  rsvpToDrive,
  cancelDrive,
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
  getCalendarDrives
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
    time: { required: true, type: 'string' },
    location: { required: true, type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    maxAttendees: { type: 'number', min: 1, max: 1000 }
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
    time: { type: 'string' },
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

module.exports = router;
