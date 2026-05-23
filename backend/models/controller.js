const Club = require('./carclub');

// Generate an invite code with reasonable uniqueness for a demo/project.
// Stored in DB as `inviteCode` (unique: true).
const generateInviteCode = () => {
    return 'DC' + Math.random().toString(36).substr(2, 8).toUpperCase();
};

// Create a car club
const createClub = async (req, res) => {
    try {
        const { name, description, leader } = req.body;

        const inviteCode = generateInviteCode();

        const newClub = new Club({
            name,
            description,
            inviteCode,
            leader: leader || req.user._id
        });

        await newClub.save();
        res.status(201).json(newClub);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Join a car club via clubId
const joinClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ message: 'Club not found' });
        if (club.members.includes(req.user._id)) return res.status(400).json({ message: 'Already a member of this club' });
        club.members.push(req.user._id);
        await club.save();
        res.status(200).json(club);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Join a car club via inviteCode
// Expected: req.body.inviteCode OR req.params.inviteCode (depending on route design)
const joinClubByInviteCode = async (req, res) => {
    try {
        const inviteCode = req.body?.inviteCode || req.params?.inviteCode;
        if (!inviteCode) return res.status(400).json({ message: 'inviteCode is required' });

        const club = await Club.findOne({ inviteCode });
        if (!club) return res.status(404).json({ message: 'Club not found for this invite code' });

        if (club.members.includes(req.user._id)) {
            return res.status(400).json({ message: 'Already a member of this club' });
        }

        club.members.push(req.user._id);
        await club.save();

        res.status(200).json(club);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Leave a car club
const leaveClub = async (req, res) => {
    try {
        const { clubId } = req.params;
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ message: 'Club not found' });
        if (!club.members.includes(req.user._id)) return res.status(400).json({ message: 'Not a member of this club' });
        club.members = club.members.filter(member => member.toString() !== req.user._id.toString());
        await club.save();
        res.status(200).json(club);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createClub,
    joinClub,
    joinClubByInviteCode,
    leaveClub
};
