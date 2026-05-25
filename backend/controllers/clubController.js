const Club = require('../models/club');

const createClub = async (req, res) => {
  try {
    const { name, description, location, maxMembers } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!name || !description) {
      return res.status(400).json({ success: false, message: 'Name and description are required' });
    }

    const existingClub = await Club.findOne({ name });
    if (existingClub) {
      return res.status(400).json({ success: false, message: 'A club with this name already exists' });
    }

    const club = await Club.create({
      name,
      description,
      location: location || '',
      maxMembers: maxMembers || null,
      leader: userId,
      members: [userId]
    });

    res.status(201).json({
      success: true,
      message: 'Club created successfully',
      club
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserClubs = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const clubs = await Club.find({ members: userId }).populate('leader', 'username email');

    res.json({ success: true, clubs });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getClubById = async (req, res) => {
  try {
    const { clubId } = req.params;
    const club = await Club.findById(clubId)
      .populate('leader', 'username email avatar name useDisplayName car')
      .populate('members', 'username email avatar name useDisplayName car');

    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    res.json({ success: true, club });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getClubByInviteCode = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const club = await Club.findOne({ inviteCode })
      .populate('leader', 'username email avatar name useDisplayName car')
      .populate('members', 'username email avatar name useDisplayName car');

    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    res.json({ success: true, club });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const requestToJoinClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    const existingRequest = club.joinRequests.find(
      (r) => r.user.toString() === userId && r.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'Request already pending' });
    }

    const isMember = club.members.some((m) => m.toString() === userId);
    if (isMember) {
      return res.status(400).json({ success: false, message: 'Already a member' });
    }

    club.joinRequests.push({ user: userId });
    await club.save();

    res.json({ success: true, message: 'Join request sent' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleJoinRequest = async (req, res) => {
  try {
    const { clubId, requestId, status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    if (club.leader.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only the leader can handle requests' });
    }

    const request = club.joinRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = status;

    if (status === 'accepted') {
      if (club.maxMembers && club.members.length >= club.maxMembers) {
        return res.status(400).json({ success: false, message: 'Club is full' });
      }
      club.members.push(request.user);
    }

    await club.save();
    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const searchClubs = async (req, res) => {
  try {
    const { query, filter } = req.query;
    let searchQuery = {};
    
    // Only show public clubs when filter is 'public' or 'all' (default)
    // Private clubs should not appear in browse unless user is invited
    if (filter !== 'public') {
      // For 'all' filter, show only public clubs (not private ones)
      searchQuery.isPrivate = false;
    } else {
      searchQuery.isPrivate = false;
    }
    
    if (query) {
      searchQuery.name = { $regex: query, $options: 'i' };
    }
    
    const clubs = await Club.find(searchQuery)
      .populate('leader', 'username email')
      .limit(50);

    console.log('Search clubs - filter:', filter, 'query:', query, 'results:', clubs.length);
    res.json({ success: true, clubs });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const toggleClubPrivacy = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { isPrivate } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    if (club.leader.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only the leader can change privacy settings' });
    }

    club.isPrivate = isPrivate;
    await club.save();

    res.json({ success: true, message: `Club is now ${isPrivate ? 'private' : 'public'}`, club });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const joinClubByInviteCode = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const club = await Club.findOne({ inviteCode })
      .populate('leader', 'username email');
    
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    const isMember = club.members.some((m) => m.toString() === userId);
    if (isMember) {
      return res.status(400).json({ success: false, message: 'Already a member' });
    }

    // If private club, check if there's a pending invite request or leader approval
    if (club.isPrivate) {
      const existingRequest = club.joinRequests.find(
        (r) => r.user.toString() === userId && r.status === 'accepted'
      );
      if (!existingRequest) {
        return res.status(403).json({ success: false, message: 'This is a private club. You need an invite from the leader.' });
      }
    }

    club.members.push(userId);
    await club.save();

    res.json({ success: true, message: 'Joined club successfully', club });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    // Verify user is the club leader
    if (club.leader.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only the club leader can delete this club' });
    }

    // Delete the club
    await Club.findByIdAndDelete(clubId);

    res.json({ success: true, message: 'Club deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { 
  createClub, 
  getUserClubs, 
  getClubById, 
  getClubByInviteCode,
  requestToJoinClub,
  handleJoinRequest,
  searchClubs,
  toggleClubPrivacy,
  joinClubByInviteCode,
  deleteClub
};
