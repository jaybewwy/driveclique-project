const Club = require('../models/carclub');   // Your club model name

// Middleware to check if user is the leader of the club
const isClubLeader = async (req, res, next) => {
    try {
        const { clubId } = req.body;   // clubId will come from request body when creating drive

        if (!clubId) {
            return res.status(400).json({ success: false, message: "clubId is required" });
        }

        const club = await Club.findById(clubId);

        if (!club) {
            return res.status(404).json({ success: false, message: "Club not found" });
        }

        // Check if user is the leader
        if (club.leader.toString() !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: "Only the club leader can create drives for this club" 
            });
        }

        req.club = club;   // Attach club for later use
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { isClubLeader };