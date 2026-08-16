const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authentication');
const { apiLimiter, strictLimiter } = require('../middleware/rateLimiters');
const { validateParams, validateInput, validateQuery } = require('../middleware/validation');
const { CLUB_TAGS } = require('../models/club');
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
  leaveClub,
  removeMember,
  transferOwnership,
  postAnnouncement,
  deleteAnnouncement,
  promoteCoLeader,
  demoteCoLeader
} = require('../controllers/clubController');

// All routes require authentication
router.use(protect);
router.use(apiLimiter);

// Shared by the create and update routes below
const tagsRule = {
  type: 'array',
  custom: (value) => (
    value.length <= 5 && value.every((t) => CLUB_TAGS.includes(t))
      ? undefined
      : `tags must be up to 5 values from: ${CLUB_TAGS.join(', ')}`
  )
};

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
    isPrivate: { type: 'boolean' },
    tags: tagsRule
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
  validateQuery({ query: { maxLength: 100 }, page: { type: 'number', min: 1 }, limit: { type: 'number', min: 1, max: 50 }, tags: { maxLength: 200 } }),
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
  strictLimiter, // invite codes are a 6-char secret (~16.7M keyspace) — bound guessing speed
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
  strictLimiter, // same brute-force protection as join-by-code above
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
    isPrivate: { type: 'boolean' },
    tags: tagsRule
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

/**
 * @route   PUT /api/clubs/:clubId/transfer
 * @desc    Transfer club ownership to another member
 * @access  Private (Club Leaders only)
 */
router.put(
  '/:clubId/transfer',
  validateParams({ clubId: { required: true, objectId: true } }),
  validateInput({ newLeaderId: { required: true, type: 'string' } }),
  transferOwnership
);

/**
 * @route   PUT /api/clubs/:clubId/promote
 * @desc    Promote a member to co-leader (UC-10)
 * @access  Private (Club Leader only)
 */
router.put(
  '/:clubId/promote',
  validateParams({ clubId: { required: true, objectId: true } }),
  validateInput({ userId: { required: true, type: 'string' } }),
  promoteCoLeader
);

/**
 * @route   PUT /api/clubs/:clubId/demote
 * @desc    Demote a co-leader back to regular member (UC-10)
 * @access  Private (Club Leader only)
 */
router.put(
  '/:clubId/demote',
  validateParams({ clubId: { required: true, objectId: true } }),
  validateInput({ userId: { required: true, type: 'string' } }),
  demoteCoLeader
);

/**
 * @route   DELETE /api/clubs/:clubId/members/:memberId
 * @desc    Remove a member from a club (leader or co-leader)
 * @access  Private (Club Leaders and Co-Leaders)
 */
router.delete(
  '/:clubId/members/:memberId',
  validateParams({
    clubId: { required: true, objectId: true },
    memberId: { required: true, objectId: true }
  }),
  removeMember
);

/**
 * @route   POST /api/clubs/:clubId/announcements
 * @desc    Post a new announcement (leader only)
 * @access  Private (Club Leaders only)
 */
router.post(
  '/:clubId/announcements',
  validateParams({ clubId: { required: true, objectId: true } }),
  validateInput({
    title: { type: 'string', maxLength: 100 },
    body:  { required: true, type: 'string', minLength: 1, maxLength: 1000 }
  }),
  postAnnouncement
);

/**
 * @route   DELETE /api/clubs/:clubId/announcements/:announcementId
 * @desc    Delete an announcement (leader only)
 * @access  Private (Club Leaders only)
 */
router.delete(
  '/:clubId/announcements/:announcementId',
  validateParams({
    clubId:         { required: true, objectId: true },
    announcementId: { required: true, objectId: true }
  }),
  deleteAnnouncement
);

module.exports = router;
