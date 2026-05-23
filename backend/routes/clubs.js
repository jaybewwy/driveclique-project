const express = require('express');
const router = express.Router();
const { 
    createClub, 
    searchClubs, 
    joinClubByInviteCode, 
    deleteClub 
} = require('../controllers/clubController');

const { protect } = require('../middleware/auth');   // Protect authenticated routes

// Public route
router.get('/search', searchClubs);

// Protected routes (require login)
router.post('/', protect, createClub);                    // Create club
router.post('/join', protect, joinClubByInviteCode);      // Join using invite code
router.delete('/:clubId', protect, deleteClub);           // Delete club (Leader only)

module.exports = router;