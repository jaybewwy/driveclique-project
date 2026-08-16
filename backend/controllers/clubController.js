const Club = require('../models/club');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { sendEmail, emailTemplates } = require('../services/emailService');
const logger = require('../utils/logger');
const { escapeRegex } = require('../utils/regex');
const { isClubLeader, hasLeaderPrivileges } = require('../utils/clubPermissions');
const { CLUB_TAGS, MAX_CO_LEADERS } = Club;

/**
 * Push a pending join request onto a club and notify the leader + co-leaders.
 * Shared by requestToJoinClub (the "Join" button) and joinClubByInviteCode
 * (entering a valid code on a private club) — both land in the same
 * leader/co-leader approval queue (UC-10).
 */
const submitPendingJoinRequest = (club, userId) => {
  const existingRequest = club.joinRequests.find(
    (r) => r.user.toString() === userId && r.status === 'pending'
  );
  if (existingRequest) {
    throw new AppError('Request already pending', 400);
  }

  club.joinRequests.push({ user: userId });

  const leaderId = (club.leader._id || club.leader).toString();
  const recipientIds = [leaderId, ...club.coLeaders.map((id) => (id._id || id).toString())];
  recipientIds.forEach((recipientId) => {
    notify(recipientId, {
      type: 'JOIN_REQUEST',
      message: `Someone requested to join "${club.name}"`,
      data: { clubId: club._id }
    });
  });
};

/**
 * Create a new Club
 * @route POST /api/clubs
 * @access Private
 */
const createClub = asyncHandler(async (req, res) => {
  const { name, description, location, maxMembers, isPrivate, tags } = req.body;
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
    tags: Array.isArray(tags) ? tags : [],
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
    .populate('leader', 'username email')
    .lean();

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
    .populate('leader', 'username email avatar name useDisplayName cars')
    .populate('members', 'username email avatar name useDisplayName cars')
    .populate('coLeaders', 'username email avatar name useDisplayName cars')
    .populate('joinRequests.user', 'username email avatar name useDisplayName')
    .lean();

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

  // A valid invite code only proves the requester was given the code by
  // someone — not that they're a member. Email is left out of this preview
  // (unlike getClubById, which is reached only after actually joining/being
  // a member) so guessing/leaking a code can't be used to harvest members'
  // email addresses off a private club.
  const club = await Club.findOne({ inviteCode })
    .populate('leader', 'username avatar name useDisplayName cars')
    .populate('members', 'username avatar name useDisplayName cars')
    .lean();

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

  // For private clubs, submit a pending request for leader/co-leader approval
  submitPendingJoinRequest(club, userId);
  await club.save();

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

  // Leader or co-leader can handle requests (UC-10)
  if (!hasLeaderPrivileges(club, userId)) {
    throw new AppError('Only the leader or a co-leader can handle requests', 403);
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
  const { query, page = 1, limit = 20, tags } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const searchQuery = { isPrivate: false };
  if (query) {
    const regex = { $regex: escapeRegex(query.trim()), $options: 'i' };
    searchQuery.$or = [{ name: regex }, { location: regex }];
  }
  if (tags) {
    // Comma-separated tag list (e.g. "JDM,Track"); unknown values are silently
    // dropped rather than rejected — this is a passive read-time filter, not a
    // leader-facing write, so it fails open like the app's other read filters.
    const validTags = tags.split(',').map((t) => t.trim()).filter((t) => CLUB_TAGS.includes(t));
    if (validTags.length > 0) {
      // $in against an array field matches clubs with ANY of the given tags (OR logic)
      searchQuery.tags = { $in: validTags };
    }
  }

  const [clubs, total] = await Promise.all([
    Club.find(searchQuery)
      .populate('leader', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
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

  // For private clubs, a valid invite code submits a join request for
  // leader/co-leader approval — same queue as the "Join" button (UC-10).
  // Having the code isn't a bypass; it just gets you in front of the leader.
  if (club.isPrivate) {
    const alreadyAccepted = club.joinRequests.find(
      (r) => r.user.toString() === userId && r.status === 'accepted'
    );
    if (!alreadyAccepted) {
      submitPendingJoinRequest(club, userId);
      await club.save();
      return res.json({
        success: true,
        pending: true,
        message: 'Join request sent. Awaiting leader approval.'
      });
    }
    // Already-accepted request that never completed membership (legacy edge
    // case) — fall through and join immediately.
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
  const { name, description, location, avatar, isPrivate, tags } = req.body;
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
  if (tags !== undefined) club.tags = tags;

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

  logger.info('Club deleted', { clubId, clubName: club.name, reason: deletionReason || null, deletedBy: req.user.id });

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
  // The new leader is redundant as a co-leader now — clear it if present.
  club.coLeaders = club.coLeaders.filter((id) => id.toString() !== newLeaderId);
  await club.save();

  const updated = await Club.findById(clubId)
    .populate('leader', 'username email avatar name useDisplayName')
    .populate('members', 'username email avatar name useDisplayName cars')
    .populate('coLeaders', 'username email avatar name useDisplayName cars')
    .lean();

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

  if (!hasLeaderPrivileges(club, userId)) {
    throw new AppError('Only the club leader or a co-leader can remove members', 403);
  }

  if (club.leader.toString() === memberId) {
    throw new AppError('Cannot remove the club leader', 400);
  }

  const targetIsCoLeader = club.coLeaders.some((id) => id.toString() === memberId);
  if (targetIsCoLeader && !isClubLeader(club, userId)) {
    throw new AppError('Only the club leader can remove a co-leader', 403);
  }

  const isMember = club.members.some((m) => m.toString() === memberId);
  if (!isMember) {
    throw new AppError('User is not a member of this club', 400);
  }

  club.members = club.members.filter((m) => m.toString() !== memberId);
  // Removing a co-leader from the club also ends their co-leader status —
  // you can't be a co-leader of a club you're not a member of.
  if (targetIsCoLeader) {
    club.coLeaders = club.coLeaders.filter((id) => id.toString() !== memberId);
  }
  await club.save();

  res.json({ success: true, message: 'Member removed successfully' });
});

/**
 * Post an Announcement
 * @route POST /api/clubs/:clubId/announcements
 * @access Private (Club Leaders only)
 */
const postAnnouncement = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { title, body } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new AppError('Authentication required', 401);
  if (!body?.trim()) throw new AppError('Announcement body is required', 400);

  const club = await Club.findById(clubId);
  if (!club) throw new AppError('Club not found', 404);
  if (!hasLeaderPrivileges(club, userId)) throw new AppError('Only the club leader or a co-leader can post announcements', 403);

  const announcement = { title: title?.trim() || '', body: body.trim(), createdBy: userId };
  club.announcements.push(announcement);
  await club.save();

  const newAnnouncement = club.announcements[club.announcements.length - 1];

  // Notify all members via SSE
  club.members.forEach((memberId) => {
    if (memberId.toString() !== userId) {
      notify(memberId.toString(), {
        type: 'NEW_ANNOUNCEMENT',
        message: `${club.name} posted a new announcement`,
        data: { clubId: club._id, clubName: club.name, announcement: newAnnouncement }
      });
    }
  });

  res.status(201).json({ success: true, announcement: newAnnouncement });
});

/**
 * Delete an Announcement
 * @route DELETE /api/clubs/:clubId/announcements/:announcementId
 * @access Private (Club Leaders only)
 */
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { clubId, announcementId } = req.params;
  const userId = req.user?.id;

  if (!userId) throw new AppError('Authentication required', 401);

  const club = await Club.findById(clubId);
  if (!club) throw new AppError('Club not found', 404);
  if (!hasLeaderPrivileges(club, userId)) throw new AppError('Only the club leader or a co-leader can delete announcements', 403);

  const exists = club.announcements.id(announcementId);
  if (!exists) throw new AppError('Announcement not found', 404);

  club.announcements.pull(announcementId);
  await club.save();

  res.json({ success: true, message: 'Announcement deleted' });
});

/**
 * Promote a Member to Co-Leader (UC-10)
 * @route PUT /api/clubs/:clubId/promote
 * @access Private (Club Leader only)
 */
const promoteCoLeader = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { userId: targetUserId } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new AppError('Authentication required', 401);
  if (!targetUserId) throw new AppError('userId is required', 400);

  const club = await Club.findById(clubId);
  if (!club) throw new AppError('Club not found', 404);

  if (!isClubLeader(club, userId)) {
    throw new AppError('Only the club leader can promote a co-leader', 403);
  }

  if (club.leader.toString() === targetUserId) {
    throw new AppError('The leader cannot be promoted to co-leader', 400);
  }

  const isMember = club.members.some((m) => m.toString() === targetUserId);
  if (!isMember) {
    throw new AppError('User must be a member of this club to be promoted', 400);
  }

  const alreadyCoLeader = club.coLeaders.some((id) => id.toString() === targetUserId);
  if (alreadyCoLeader) {
    throw new AppError('User is already a co-leader', 400);
  }

  if (club.coLeaders.length >= MAX_CO_LEADERS) {
    throw new AppError(`A club can have at most ${MAX_CO_LEADERS} co-leaders`, 400);
  }

  club.coLeaders.push(targetUserId);
  await club.save();

  notify(targetUserId, {
    type: 'COLEADER_PROMOTED',
    message: `You were promoted to co-leader of "${club.name}"`,
    data: { clubId: club._id }
  });

  const updated = await Club.findById(clubId)
    .populate('coLeaders', 'username email avatar name useDisplayName cars')
    .lean();

  res.json({ success: true, message: 'Member promoted to co-leader', club: updated });
});

/**
 * Demote a Co-Leader back to Regular Member (UC-10)
 * @route PUT /api/clubs/:clubId/demote
 * @access Private (Club Leader only)
 */
const demoteCoLeader = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { userId: targetUserId } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new AppError('Authentication required', 401);
  if (!targetUserId) throw new AppError('userId is required', 400);

  const club = await Club.findById(clubId);
  if (!club) throw new AppError('Club not found', 404);

  if (!isClubLeader(club, userId)) {
    throw new AppError('Only the club leader can demote a co-leader', 403);
  }

  const isCoLeader = club.coLeaders.some((id) => id.toString() === targetUserId);
  if (!isCoLeader) {
    throw new AppError('User is not a co-leader of this club', 400);
  }

  club.coLeaders = club.coLeaders.filter((id) => id.toString() !== targetUserId);
  await club.save();

  notify(targetUserId, {
    type: 'COLEADER_DEMOTED',
    message: `You are no longer a co-leader of "${club.name}"`,
    data: { clubId: club._id }
  });

  res.json({ success: true, message: 'Co-leader demoted to member', club });
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
  transferOwnership,
  postAnnouncement,
  deleteAnnouncement,
  promoteCoLeader,
  demoteCoLeader
};
