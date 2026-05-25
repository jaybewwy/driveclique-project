const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authentication');
const { validateParams, validateInput } = require('../middleware/validation');
const {
  createDrive,
  getClubDrives,
  rsvpToDrive,
  cancelDrive,
  updateDrive,
  deleteDrive,
  getDriveAttendees,
  getLeaderDashboard
} = require('../controllers/driveController');

// All routes require authentication
router.use(protect);

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

module.exports = router;
