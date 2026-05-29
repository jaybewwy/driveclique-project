const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authentication');
const { validateParams, validateInput, validateQuery } = require('../middleware/validation');
const { 
  createClub, 
  getUserClubs, 
  getClubById, 
  getClubByInviteCode,
  requestToJoinClub,
  handleJoinRequest,
  searchClubs,
  toggleClubPrivacy,
  joinClubByInviteCode,
  updateClub,
  deleteClub,
  getTopClub,
  leaveClub
} = require('../controllers/clubController');

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/clubs
 * @desc    Create a new club
 * @access  Private
 */
router.post(
  '/',
  validateInput({
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    description: { required: true, type: 'string', minLength: 10, maxLength: 1000 },
    location: { type: 'string', maxLength: 200 },
    maxMembers: { type: 'number', min: 2, max: 10000 },
    isPrivate: { type: 'boolean' }
  }),
  createClub
);

/**
 * @route   GET /api/clubs
 * @desc    Get all clubs for current user
 * @access  Private
 */
router.get('/', getUserClubs);

/**
 * @route   GET /api/clubs/browse
 * @desc    Search and browse public clubs
 * @access  Private
 */
router.get(
  '/browse',
  validateQuery({ query: { maxLength: 100 } }),
  searchClubs
);

/**
 * @route   GET /api/clubs/trending
 * @desc    Get the top club by member count
 * @access  Private
 */
router.get('/trending', getTopClub);

/**
 * @route   POST /api/clubs/join-by-code/:inviteCode
 * @desc    Join a club using invite code
 * @access  Private
 */
router.post(
  '/join-by-code/:inviteCode',
  validateParams({
    inviteCode: { required: true, type: 'string' }
  }),
  joinClubByInviteCode
);

/**
 * @route   GET /api/clubs/invite/:inviteCode
 * @desc    Get club details by invite code
 * @access  Private
 */
router.get(
  '/invite/:inviteCode',
  validateParams({
    inviteCode: { required: true, type: 'string' }
  }),
  getClubByInviteCode
);

/**
 * @route   POST /api/clubs/:clubId/join
 * @desc    Request to join a club
 * @access  Private
 */
router.post(
  '/:clubId/join',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  requestToJoinClub
);

/**
 * @route   POST /api/clubs/:clubId/handle-request
 * @desc    Handle a join request (accept/reject)
 * @access  Private (Club Leaders only)
 */
router.post(
  '/:clubId/handle-request',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  validateInput({
    requestId: { required: true, type: 'string' },
    status: { required: true, type: 'string', enum: ['accepted', 'rejected'] }
  }),
  handleJoinRequest
);

/**
 * @route   POST /api/clubs/:clubId/toggle-privacy
 * @desc    Toggle club privacy setting
 * @access  Private (Club Leaders only)
 */
router.post(
  '/:clubId/toggle-privacy',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  validateInput({
    isPrivate: { required: true, type: 'boolean' }
  }),
  toggleClubPrivacy
);

/**
 * @route   GET /api/clubs/:clubId
 * @desc    Get club details by ID
 * @access  Private
 */
router.get(
  '/:clubId',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  getClubById
);

/**
 * @route   PUT /api/clubs/:clubId
 * @desc    Update a club (name, description, avatar, privacy)
 * @access  Private (Club Leaders only)
 */
router.put(
  '/:clubId',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  validateInput({
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', minLength: 10, maxLength: 1000 },
    location: { type: 'string', maxLength: 200 },
    avatar: { type: 'string', maxLength: 100000 },
    isPrivate: { type: 'boolean' }
  }),
  updateClub
);

/**
 * @route   DELETE /api/clubs/:clubId
 * @desc    Delete a club
 * @access  Private (Club Leaders only)
 */
router.delete(
  '/:clubId',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  validateInput({
    deletionReason: { required: true, type: 'string', minLength: 10, maxLength: 500 },
    leaderEmail: { required: true, type: 'string', email: true }
  }),
  deleteClub
);

/**
 * @route   PUT /api/clubs/:clubId/leave
 * @desc    Leave a club (remove yourself from members)
 * @access  Private
 */
router.put(
  '/:clubId/leave',
  validateParams({
    clubId: { required: true, objectId: true }
  }),
  leaveClub
);

module.exports = router;
