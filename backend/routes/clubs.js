const express = require('express');
const router = express.Router();

// Import controller functions
const { 
    createClub, 
    searchClubs, 
    joinClubByInviteCode, 
    kickMember,
    unbanMember,
    leaveClub,
    deleteClub 
} = require('../controllers/controller');

// Import authentication middleware
const { protect } = require('../middleware/authentication');

// ====================== PUBLIC ROUTES ======================
router.get('/search', searchClubs);                    // Search clubs by name (No login required)

// ====================== PROTECTED ROUTES ======================
router.post('/', protect, createClub);                 // Create a new club
router.post('/join', protect, joinClubByInviteCode);   // Join club using invite code

// Member Actions
router.post('/:clubId/leave', protect, leaveClub);     // Member leaves the club

// Leader Only Actions
router.delete('/:clubId/members/:memberId', protect, kickMember);   // Kick / Ban member
router.post('/:clubId/unban/:memberId', protect, unbanMember);      // Unban member
router.delete('/:clubId', protect, deleteClub);                     // Delete entire club

module.exports = router;