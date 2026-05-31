const Club = require('../models/club');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { sendEmail, emailTemplates } = require('../services/emailService');

/**
 * Escape special regex characters in a string to prevent ReDoS
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Create a new Club
 * @route POST /api/clubs
 * @access Private
 */
const createClub = asyncHandler(async (req, res) => {
  const { name, description, location, maxMembers, isPrivate } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  // Check for duplicate club name
  const existingClub = await Club.findOne({ name });
  if (existingClub) {
    throw new AppError('A club with this name already exists', 400);
  }

  const club = await Club.create({
    name,
    description,
    location: location || '',
    maxMembers: maxMembers || null,
    isPrivate: isPrivate === true ? true : false,
    leader: userId,
    members: [userId]
  });

  res.status(201).json({
    success: true,
    message: 'Club created successfully',
    club
  });
});

/**
 * Get User's Clubs
 * @route GET /api/clubs
 * @access Private
 */
const getUserClubs = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const clubs = await Club.find({ members: userId })
    .populate('leader', 'username email');

  res.json({ success: true, clubs });
});

/**
 * Get Club by ID
 * @route GET /api/clubs/:clubId
 * @access Private
 */
const getClubById = asyncHandler(async (req, res) => {
  const { clubId } = req.params;

  const club = await Club.findById(clubId)
    .populate('leader', 'username email avatar name useDisplayName car')
    .populate('members', 'username email avatar name useDisplayName car');

  if (!club) {
    throw new AppError('Club not found', 404);
  }

  res.json({ success: true, club });
});

/**
 * Get Club by Invite Code
 * @route GET /api/clubs/invite/:inviteCode
 * @access Private
 */
const getClubByInviteCode = asyncHandler(async (req, res) => {
  const { inviteCode } = req.params;

  const club = await Club.findOne({ inviteCode })
    .populate('leader', 'username email avatar name useDisplayName car')
    .populate('members', 'username email avatar name useDisplayName car');

  if (!club) {
    throw new AppError('Club not found', 404);
  }

  res.json({ success: true, club });
});

/**
 * Request to Join a Club (for private clubs) or Join Immediately (for public clubs)
 * @route POST /api/clubs/:clubId/join
 * @access Private
 */
const requestToJoinClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Check if already a member
  const isMember = club.members.some((m) => m.toString() === userId);
  if (isMember) {
    throw new AppError('Already a member', 400);
  }

  // For public clubs (isPrivate is false), add user directly without requiring approval
  if (club.isPrivate === false) {
    if (club.maxMembers && club.members.length >= club.maxMembers) {
      throw new AppError('This club is full and cannot accept new members', 400);
    }
    club.members.push(userId);
    await club.save();

    return res.json({
      success: true,
      message: 'Joined club successfully',
      clubId: club._id,
      clubName: club.name
    });
  }

  // For private clubs, check for existing pending request
  const existingRequest = club.joinRequests.find(
    (r) => r.user.toString() === userId && r.status === 'pending'
  );

  if (existingRequest) {
    throw new AppError('Request already pending', 400);
  }

  club.joinRequests.push({ user: userId });
  await club.save();

  // Notify the club leader of the new join request
  notify(club.leader.toString(), {
    type: 'JOIN_REQUEST',
    message: `Someone requested to join "${club.name}"`,
    data: { clubId: club._id }
  });

  res.json({ success: true, message: 'Join request sent. Awaiting leader approval.' });
});

/**
 * Handle Join Request (Accept/Reject)
 * @route POST /api/clubs/:clubId/handle-request
 * @access Private (Club Leaders only)
 */
const handleJoinRequest = asyncHandler(async (req, res) => {
  // Use clubId from URL params (not body) to prevent parameter tampering
  const { clubId } = req.params;
  const { requestId, status } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Verify user is the club leader
  if (club.leader.toString() !== userId) {
    throw new AppError('Only the leader can handle requests', 403);
  }

  // Find the request
  const request = club.joinRequests.id(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Update request status
  request.status = status;

  // If accepted, add user to members (if not already a member and space is available)
  if (status === 'accepted') {
    const alreadyMember = club.members.some(m => m.toString() === request.user.toString());
    if (!alreadyMember) {
      if (club.maxMembers && club.members.length >= club.maxMembers) {
        throw new AppError('Club is full', 400);
      }
      club.members.push(request.user);
    }
  }

  await club.save();

  // Notify the requesting user of the decision
  notify(request.user.toString(), {
    type: status === 'accepted' ? 'JOIN_ACCEPTED' : 'JOIN_REJECTED',
    message: status === 'accepted'
      ? `Your request to join "${club.name}" was accepted!`
      : `Your request to join "${club.name}" was declined.`,
    data: { clubId: club._id }
  });

  // Send email confirmation to the requesting user
  const User = require('../models/user');
  const requestingUser = await User.findById(request.user).select('email');
  if (requestingUser?.email) {
    const joinTpl = status === 'accepted'
      ? emailTemplates.joinRequestAccepted({ clubName: club.name })
      : emailTemplates.joinRequestRejected({ clubName: club.name });
    sendEmail({ to: requestingUser.email, ...joinTpl });
  }

  res.json({ success: true, message: `Request ${status}` });
});

/**
 * Search Clubs
 * @route GET /api/clubs/browse
 * @access Private
 */
const searchClubs = asyncHandler(async (req, res) => {
  const { query, location, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const searchQuery = { isPrivate: false };
  if (query) {
    searchQuery.name = { $regex: escapeRegex(query.trim()), $options: 'i' };
  }
  if (location) {
    searchQuery.location = { $regex: escapeRegex(location.trim()), $options: 'i' };
  }

  const [clubs, total] = await Promise.all([
    Club.find(searchQuery)
      .populate('leader', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Club.countDocuments(searchQuery),
  ]);

  res.json({
    success: true,
    clubs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: skip + clubs.length < total,
    },
  });
});

/**
 * Toggle Club Privacy
 * @route POST /api/clubs/:clubId/toggle-privacy
 * @access Private (Club Leaders only)
 */
const toggleClubPrivacy = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { isPrivate } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Verify user is the club leader
  if (club.leader.toString() !== userId) {
    throw new AppError('Only the leader can change privacy settings', 403);
  }

  club.isPrivate = isPrivate;
  await club.save();

  res.json({ 
    success: true, 
    message: `Club is now ${isPrivate ? 'private' : 'public'}`, 
    club 
  });
});

/**
 * Join Club by Invite Code
 * @route POST /api/clubs/join-by-code/:inviteCode
 * @access Private
 */
const joinClubByInviteCode = asyncHandler(async (req, res) => {
  const { inviteCode } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findOne({ inviteCode })
    .populate('leader', 'username email');
  
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Check if already a member
  const isMember = club.members.some((m) => m.toString() === userId);
  if (isMember) {
    throw new AppError('Already a member', 400);
  }

  // For private clubs, verify user has been invited (accepted request)
  if (club.isPrivate) {
    const existingRequest = club.joinRequests.find(
      (r) => r.user.toString() === userId && r.status === 'accepted'
    );
    if (!existingRequest) {
      throw new AppError('This is a private club. You need an invite from the leader.', 403);
    }
  }

  if (club.maxMembers && club.members.length >= club.maxMembers) {
    throw new AppError('This club is full and cannot accept new members', 400);
  }

  club.members.push(userId);
  await club.save();

  res.json({ success: true, message: 'Joined club successfully', club });
});

/**
 * Update a Club (Edit name, description, avatar)
 * @route PUT /api/clubs/:clubId
 * @access Private (Club Leaders only)
 */
const updateClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { name, description, location, avatar, isPrivate } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Verify user is the club leader
  if (club.leader.toString() !== userId) {
    throw new AppError('Only the club leader can update this club', 403);
  }

  // Check for duplicate club name (if name is being changed)
  if (name && name !== club.name) {
    const existingClub = await Club.findOne({ name, _id: { $ne: clubId } });
    if (existingClub) {
      throw new AppError('A club with this name already exists', 400);
    }
    club.name = name;
  }

  // Update fields if provided
  if (description !== undefined) club.description = description;
  if (location !== undefined) club.location = location;
  if (avatar !== undefined) club.avatar = avatar;
  if (isPrivate !== undefined) club.isPrivate = isPrivate;

  await club.save();

  res.json({
    success: true,
    message: 'Club updated successfully',
    club
  });
});

/**
 * Delete a Club
 * @route DELETE /api/clubs/:clubId
 * @access Private (Club Leaders only)
 */
const deleteClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { deletionReason, leaderEmail } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId)
    .populate('leader', 'email username');
  
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Verify user is the club leader
  if (club.leader._id.toString() !== userId) {
    throw new AppError('Only the club leader can delete this club', 403);
  }

  // Verify the provided email matches the leader's email
  if (!leaderEmail || club.leader.email.toLowerCase() !== leaderEmail.toLowerCase()) {
    throw new AppError("Email does not match the registered group leader's email", 403);
  }

  // Log deletion for audit purposes
  console.log(`[Club Deletion] "${club.name}" (ID: ${clubId}) - Reason: ${deletionReason || 'Not provided'}`);

  // Delete RSVPs for every drive in the club before removing drives
  const Drive = require('../models/drive');
  const RSVP = require('../models/rsvp');
  const clubDriveIds = await Drive.find({ club: clubId }).select('_id').lean();
  if (clubDriveIds.length) {
    await RSVP.deleteMany({ drive: { $in: clubDriveIds.map(d => d._id) } });
  }

  // Delete all drives associated with the club
  await Drive.deleteMany({ club: clubId });

  // Delete the club
  await Club.findByIdAndDelete(clubId);

  res.json({ success: true, message: 'Club deleted successfully' });
});

/**
 * Get Top Club by Member Count and Completed Drives
 * @route GET /api/clubs/trending
 * @access Private
 *
 * OPTIMIZED: Uses a single aggregation pipeline instead of N+1 Drive.countDocuments calls
 */
const getTopClub = asyncHandler(async (req, res) => {
  const Drive = require('../models/drive');

  // Get all public club IDs first
  const publicClubs = await Club.find({ isPrivate: false })
    .select('_id')
    .lean();

  if (!publicClubs.length) {
    return res.json({ success: true, club: null });
  }

  const publicClubIds = publicClubs.map(c => c._id);

  // Single aggregation: count completed drives per public club
  const driveCounts = await Drive.aggregate([
    { $match: { club: { $in: publicClubIds }, isCompleted: true } },
    { $group: { _id: '$club', completedDrivesCount: { $sum: 1 } } }
  ]);

  // Build a Map for O(1) lookup
  const driveCountMap = new Map(
    driveCounts.map(d => [d._id.toString(), d.completedDrivesCount])
  );

  // Fetch full club docs with leader populated (only public clubs)
  const clubs = await Club.find({ isPrivate: false })
    .populate('leader', 'username email avatar name')
    .limit(100);

  // Calculate trending score using the pre-fetched drive counts
  let topClubData = null;
  for (const club of clubs) {
    const completedDrivesCount = driveCountMap.get(club._id.toString()) || 0;
    const trendingScore = club.members.length + (completedDrivesCount * 5);

    if (!topClubData || trendingScore > topClubData.trendingScore) {
      topClubData = { club, memberCount: club.members.length, completedDrivesCount, trendingScore };
    }
  }

  if (!topClubData) {
    return res.json({ success: true, club: null });
  }

  const topClub = topClubData.club;
  res.json({ 
    success: true, 
    club: {
      _id: topClub._id,
      name: topClub.name,
      description: topClub.description,
      location: topClub.location,
      avatar: topClub.avatar,
      memberCount: topClubData.memberCount,
      completedDrivesCount: topClubData.completedDrivesCount,
      leader: topClub.leader
    }
  });
});

/**
 * Leave a Club
 * @route PUT /api/clubs/:clubId/leave
 * @access Private
 */
const leaveClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Check if user is a member
  const isMember = club.members.some((m) => m.toString() === userId);
  if (!isMember) {
    throw new AppError('You are not a member of this club', 400);
  }

  // Prevent the leader from leaving (they must transfer ownership or delete the club)
  if (club.leader.toString() === userId) {
    throw new AppError('The club leader cannot leave. Please transfer ownership or delete the club.', 400);
  }

  // Remove user from members
  club.members = club.members.filter((m) => m.toString() !== userId);
  await club.save();

  res.json({ success: true, message: 'You have left the club' });
});

/**
 * Transfer Club Ownership to Another Member
 * @route PUT /api/clubs/:clubId/transfer
 * @access Private (Club Leaders only)
 */
const transferOwnership = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { newLeaderId } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new AppError('Authentication required', 401);
  if (!newLeaderId) throw new AppError('newLeaderId is required', 400);

  const club = await Club.findById(clubId);
  if (!club) throw new AppError('Club not found', 404);

  if (club.leader.toString() !== userId) {
    throw new AppError('Only the current leader can transfer ownership', 403);
  }

  if (newLeaderId === userId) {
    throw new AppError('You are already the leader', 400);
  }

  const isMember = club.members.some(m => m.toString() === newLeaderId);
  if (!isMember) {
    throw new AppError('The new leader must already be a member of the club', 400);
  }

  club.leader = newLeaderId;
  await club.save();

  const updated = await Club.findById(clubId)
    .populate('leader', 'username email avatar name useDisplayName')
    .populate('members', 'username email avatar name useDisplayName car');

  res.json({ success: true, message: 'Ownership transferred successfully', club: updated });
});

/**
 * Remove a Member from a Club
 * @route DELETE /api/clubs/:clubId/members/:memberId
 * @access Private (Club Leaders only)
 */
const removeMember = asyncHandler(async (req, res) => {
  const { clubId, memberId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  if (club.leader.toString() !== userId) {
    throw new AppError('Only the club leader can remove members', 403);
  }

  if (club.leader.toString() === memberId) {
    throw new AppError('Cannot remove the club leader', 400);
  }

  const isMember = club.members.some((m) => m.toString() === memberId);
  if (!isMember) {
    throw new AppError('User is not a member of this club', 400);
  }

  club.members = club.members.filter((m) => m.toString() !== memberId);
  await club.save();

  res.json({ success: true, message: 'Member removed successfully' });
});

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
  updateClub,
  deleteClub,
  getTopClub,
  leaveClub,
  removeMember,
  transferOwnership
};
