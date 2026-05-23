const express = require('express');
const router = express.Router();
const { 
  createClub, 
  searchClubs, 
  joinClubByInviteCode 
} = require('../controllers/clubController');

// Club Routes
router.post('/', createClub);                    // Create club
router.get('/search', searchClubs);              // Search clubs by name
router.post('/join', joinClubByInviteCode);      // Join using invite code

module.exports = router;