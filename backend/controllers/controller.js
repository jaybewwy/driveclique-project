const Club = require('../models/Club');

// Generate Invite Code
const generateInviteCode = () => {
    return 'DC' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Create a new Car Club
const createClub = async (req, res) => {
    try {
        const { name, description } = req.body;
        const leaderId = req.user.id;

        if (!name) {
            return res.status(400).json({ success: false, message: "Club name is required" });
        }

        const inviteCode = generateInviteCode();

        const newClub = new Club({
            name,
            description,
            inviteCode,
            leader: leaderId,
            members: [leaderId]
        });

        await newClub.save();

        res.status(201).json({
            success: true,
            message: "Car Club created successfully!",
            club: newClub
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Search clubs by name
const searchClubs = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const clubs = await Club.find({ 
            name: { $regex: query, $options: 'i' } 
        }).select('name description inviteCode leader members');

        res.json({ success: true, clubs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Join club using Invite Code
const joinClubByInviteCode = async (req, res) => {
    try {
        const { inviteCode } = req.body;
        const userId = req.user.id;

        if (!inviteCode) {
            return res.status(400).json({ success: false, message: "Invite code is required" });
        }

        const club = await Club.findOne({ inviteCode: inviteCode.toUpperCase() });

        if (!club) {
            return res.status(404).json({ success: false, message: "Invalid invite code" });
        }

        if (club.members.includes(userId)) {
            return res.status(400).json({ success: false, message: "You are already a member" });
        }

        club.members.push(userId);
        await club.save();

        res.json({ success: true, message: "Successfully joined the club!", club });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Delete Club - Leader Only
const deleteClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const userId = req.user.id;

        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        // Check if user is the leader
        if (club.leader.toString() !== userId.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "Only the club leader can delete this club" 
            });
        }

        await Club.findByIdAndDelete(clubId);

        res.json({ success: true, message: "Club deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createClub,
    searchClubs,
    joinClubByInviteCode,
    deleteClub
};