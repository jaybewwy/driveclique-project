const express = require('express');
const router = express.Router();

const { createDrive, getClubDrives } = require('../controllers/driveController');
const { protect } = require('../middleware/authentication');   // Use your actual middleware file
const { isClubLeader } = require('../middleware/authorization'); // Middleware to check if user is club leader

// ====================== PROTECTED ROUTES ======================
router.post('/', protect, isClubLeader, createDrive);   // Create drive (Only club leader)
router.get('/:clubId', protect, getClubDrives);        // Get drives for a club (Logged in users)

module.exports = router;