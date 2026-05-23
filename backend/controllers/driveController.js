const Drive = require('../models/Drive');
const Club = require('../models/carclub');
const RSVP = require('../models/RSVP');

// Create a new Drive/Event - Only Club Leaders
const createDrive = async (req, res) => {
    try {
        const { clubId, name, date, time, location, description, difficulty, maxAttendees } = req.body;

        if (!clubId) {
            return res.status(400).json({ 
                success: false, 
                message: "clubId is required. You must create or select a club first." 
            });
        }

        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ success: false, message: "Club not found" });
        }

        if (club.leader.toString() !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: "Only the club leader can create drives for this club" 
            });
        }

        const newDrive = new Drive({
            club: clubId,
            name,
            date,
            time,
            location,
            description,
            difficulty: difficulty || 'Medium',
            maxAttendees: maxAttendees || 100,
            createdBy: req.user.id
        });

        await newDrive.save();

        res.status(201).json({
            success: true,
            message: "Drive created successfully!",
            drive: newDrive
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Get all drives for a specific club
const getClubDrives = async (req, res) => {
    try {
        const { clubId } = req.params;
        const drives = await Drive.find({ club: clubId }).sort({ date: 1 });
        res.json({ success: true, drives });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// RSVP to a Drive / Change RSVP Status
const rsvpToDrive = async (req, res) => {
    try {
        const { driveId } = req.params;
        const { status } = req.body;   // 'going', 'maybe', 'not-going'
        const userId = req.user.id;

        if (!['going', 'maybe', 'not-going'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid RSVP status" });
        }

        const drive = await Drive.findById(driveId);
        if (!drive) {
            return res.status(404).json({ success: false, message: "Drive not found" });
        }

        // Check if user already has an RSVP
        let rsvp = await RSVP.findOne({ drive: driveId, user: userId });

        if (rsvp) {
            // Update existing RSVP
            rsvp.status = status;
            await rsvp.save();
            return res.json({
                success: true,
                message: `RSVP updated to ${status}`,
                rsvp
            });
        } else {
            // Create new RSVP
            rsvp = new RSVP({
                drive: driveId,
                user: userId,
                status
            });
            await rsvp.save();
            return res.json({
                success: true,
                message: `You are now marked as ${status}`,
                rsvp
            });
        }
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Cancel a Drive - Only Club Leader
const cancelDrive = async (req, res) => {
    try {
        const { driveId } = req.params;
        const { cancellationReason } = req.body;
        const leaderId = req.user.id;

        if (!cancellationReason || cancellationReason.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: "Cancellation reason is required" 
            });
        }

        const drive = await Drive.findById(driveId).populate('club');
        if (!drive) {
            return res.status(404).json({ success: false, message: "Drive not found" });
        }

        // Verify user is the club leader
        if (drive.club.leader.toString() !== leaderId) {
            return res.status(403).json({ 
                success: false, 
                message: "Only the club leader can cancel this drive" 
            });
        }

        drive.isCancelled = true;
        drive.cancellationReason = cancellationReason.trim();
        drive.cancelledAt = new Date();
        drive.cancelledBy = leaderId;

        await drive.save();

        res.json({
            success: true,
            message: "Drive has been cancelled successfully",
            drive
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Tracking attendance and no-shows (Will only be seen by the club leader after the drive has occurred)
const getDriveAttendees = async (req, res) => {
    try {
        const { driveId } = req.params;
        const userId = req.user.id;

        const drive = await Drive.findById(driveId).populate('club');
        if (!drive) {
            return res.status(404).json({ success: false, message: "Drive not found" });
        }

        // Verify if the user is the club leader

        if (drive.club.leader.toString() !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: "Only the club leader can view the attendees of this drive"
            });
        }

        const rsvps = await RSVP.find({ drive: driveId })
            .populate('user', 'username email')
            .sort({ createdAt: -1 });

        const attendees = {
            going: rsvps.filter(r => r.status === 'going').length,
            maybe: rsvps.filter(r => r.status === 'maybe').length,
            notGoing: rsvps.filter(r => r.status === 'not-going').length
        };

        res.json({
            success: true,
            drive: {
                id: drive._id,
                name: drive.name,
                date: drive.date,
                location: drive.location,
            },
            totalRSVPs: rsvps.length,
            stats: {
                going: attendees.going,
                maybe: attendees.maybe,
                notGoing: attendees.notGoing,
                totalSpots: drive.maxAttendees,
                spotsLeft: Math.max(0, drive.maxAttendees - attendees.going)
            },
            rsvps
        });
    } catch (error) { 
        res.status(400).json({ success: false, message: error.message });
    }
};

// Dashboard for club leaders to view all their drives and other stats (This can be expanded in the future to include more detailed analytics)

// Dashboard Summary for Club Leaders
const getLeaderDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all clubs where user is the leader
        const clubs = await Club.find({ leader: userId })
            .select('name description inviteCode members bannedMembers createdAt');

        const dashboard = [];

        for (const club of clubs) {
            // Get all drives for this club
            const drives = await Drive.find({ club: club._id })
                .sort({ date: 1 });

            const driveSummaries = [];

            for (const drive of drives) {
                // Get RSVP stats
                const rsvps = await RSVP.find({ drive: drive._id });
                
                const going = rsvps.filter(r => r.status === 'going').length;
                const maybe = rsvps.filter(r => r.status === 'maybe').length;
                const notGoing = rsvps.filter(r => r.status === 'not-going').length;

                driveSummaries.push({
                    _id: drive._id,
                    name: drive.name,
                    date: drive.date,
                    time: drive.time,
                    location: drive.location,
                    isCancelled: drive.isCancelled || false,
                    rsvpStats: {
                        going,
                        maybe,
                        notGoing,
                        totalRSVPs: rsvps.length,
                        spotsLeft: drive.maxAttendees - going
                    }
                });
            }

            dashboard.push({
                club: {
                    _id: club._id,
                    name: club.name,
                    inviteCode: club.inviteCode,
                    memberCount: club.members.length
                },
                drives: driveSummaries,
                totalDrives: driveSummaries.length
            });
        }

        res.json({
            success: true,
            totalClubs: dashboard.length,
            dashboard
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createDrive,
    getClubDrives,
    rsvpToDrive,
    cancelDrive,
    getDriveAttendees // New function to get drive attendees and stats
};