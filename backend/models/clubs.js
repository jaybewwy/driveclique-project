const express = require('express');
const router = express.Router();

const { 
    createClub, 
    searchClubs, 
    joinClubByInviteCode,
    kickMember,
    leaveClub 
} = require('../controllers/controller');

const { protect } = require('../middleware/authentication');

// Public
router.get('/search', searchClubs);

// Protected
router.post('/', protect, createClub);
router.post('/join', protect, joinClubByInviteCode);

// Member actions
router.post('/:clubId/leave', protect, leaveClub);           // Member leaves club

// Leader actions
router.delete('/:clubId/members/:memberId', protect, kickMember);  // Leader kicks member

module.exports = router;