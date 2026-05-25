const Club = require('../models/club');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Create a new Club
 * @route POST /api/clubs
 * @access Private
 */
const createClub = asyncHandler(async (req, res) => {
  const { name, description, location, maxMembers } = req.body;
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
 * Request to Join a Club
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

  // Check for existing pending request
  const existingRequest = club.joinRequests.find(
    (r) => r.user.toString() === userId && r.status === 'pending'
  );

  if (existingRequest) {
    throw new AppError('Request already pending', 400);
  }

  // Check if already a member
  const isMember = club.members.some((m) => m.toString() === userId);
  if (isMember) {
    throw new AppError('Already a member', 400);
  }

  club.joinRequests.push({ user: userId });
  await club.save();

  res.json({ success: true, message: 'Join request sent' });
});

/**
 * Handle Join Request (Accept/Reject)
 * @route POST /api/clubs/:clubId/handle-request
 * @access Private (Club Leaders only)
 */
const handleJoinRequest = asyncHandler(async (req, res) => {
  const { clubId, requestId, status } = req.body;
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

  // If accepted, add user to members (if space available)
  if (status === 'accepted') {
    if (club.maxMembers && club.members.length >= club.maxMembers) {
      throw new AppError('Club is full', 400);
    }
    club.members.push(request.user);
  }

  await club.save();

  res.json({ success: true, message: `Request ${status}` });
});

/**
 * Search Clubs
 * @route GET /api/clubs/browse
 * @access Private
 */
const searchClubs = asyncHandler(async (req, res) => {
  const { query, filter } = req.query;
  
  // Build search query - only show public clubs
  const searchQuery = { isPrivate: false };
  
  if (query) {
    searchQuery.name = { $regex: query, $options: 'i' };
  }

  const clubs = await Club.find(searchQuery)
    .populate('leader', 'username email')
    .limit(50);

  res.json({ success: true, clubs });
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

  // Delete the club
  await Club.findByIdAndDelete(clubId);

  res.json({ success: true, message: 'Club deleted successfully' });
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
  deleteClub
};
