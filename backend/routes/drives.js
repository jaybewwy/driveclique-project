const express = require('express');
const router = express.Router();

// Import controllers and middleware
const { 
    createDrive, 
    getClubDrives, 
    rsvpToDrive,
    getDriveAttendees, // New function to get drive attendees and stats
    cancelDrive
} = require('../controllers/driveController');

const { protect } = require('../middleware/authentication');

// ====================== PROTECTED ROUTES ======================

// Create a new Drive (Only Club Leader)
router.post('/', protect, createDrive);

// Get all drives for a specific club
router.get('/club/:clubId', getClubDrives);

// RSVP to a Drive/Event
router.post('/:driveId/rsvp', protect, rsvpToDrive);

// New route for cancelling a drive.
router.delete('/:driveId/cancel', protect, cancelDrive); 

// Leader Dashboard Summary
router.get('/leader/dashboard', protect, getLeaderDashboard);
module.exports = router;