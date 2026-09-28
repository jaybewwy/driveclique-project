// Who is in a club and in what role: joining (open, by request, by invite
// code), join-request approval, leaving, ownership transfer, co-leader
// promotion (UC-10), removal and ban lists (UC-32), and a user blocking a
// club from their own search results.

const Club = require('../models/club');
const User = require('../models/user');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { sendEmail, emailTemplates } = require('../services/emailService');
const { isClubLeader, isClubCoLeader, isClubMember, hasLeaderPrivileges } = require('../utils/clubPermissions');
const { MAX_CO_LEADERS } = Club;

const MEMBER_FIELDS = 'username email avatar name useDisplayName cars';

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
 * Everything that must hold before a user may join or ask to join a club,
 * shared by both join paths (the "Join" button and entering an invite code)
 * so neither is a way around the other's checks:
 * - not already a member
 * - not banned by a leader/co-leader (UC-32)
 * - hasn't blocked the club themselves — the reciprocal, user-initiated
 *   restriction
 */
const assertCanJoin = async (club, userId) => {
  if (isClubMember(club, userId)) {
    throw new AppError('Already a member', 400);
  }

  const isBanned = club.bannedUsers.some((id) => id.toString() === userId);
  if (isBanned) {
    throw new AppError('You have been removed from this club by its leader and cannot rejoin.', 403);
  }

  const requestingUser = await User.findById(userId).select('blockedClubs');
  const isBlocked = (requestingUser?.blockedClubs || []).some((id) => id.toString() === club._id.toString());
  if (isBlocked) {
    throw new AppError('You have blocked this club. Unblock it first to join.', 403);
  }
};

const assertHasRoom = (club, message) => {
  if (club.maxMembers && club.members.length >= club.maxMembers) {
    throw new AppError(message, 400);
  }
};

/**
 * Request to Join a Club (for private clubs) or Join Immediately (for public clubs)
 * @route POST /api/clubs/:clubId/join
 * @access Private
 */
const requestToJoinClub = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const club = orNotFound(await Club.findById(req.params.clubId), 'Club not found');
  await assertCanJoin(club, userId);

  // For public clubs (isPrivate is false), add user directly without requiring approval
  if (club.isPrivate === false) {
    assertHasRoom(club, 'This club is full and cannot accept new members');
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
 * Join Club by Invite Code
 * @route POST /api/clubs/join-by-code/:inviteCode
 * @access Private
 */
const joinClubByInviteCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const club = orNotFound(
    await Club.findOne({ inviteCode: req.params.inviteCode }).populate('leader', 'username email'),
    'Club not found'
  );
  await assertCanJoin(club, userId);

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

  assertHasRoom(club, 'This club is full and cannot accept new members');

  club.members.push(userId);
  await club.save();

  res.json({ success: true, message: 'Joined club successfully', club });
});

/**
 * Handle Join Request (Accept/Reject)
 * @route POST /api/clubs/:clubId/handle-request
 * @access Private (Club Leaders only)
 */
const handleJoinRequest = asyncHandler(async (req, res) => {
  // Use clubId from URL params (not body) to prevent parameter tampering
  const { requestId, status } = req.body;

  const club = orNotFound(await Club.findById(req.params.clubId), 'Club not found');

  // Leader or co-leader can handle requests (UC-10)
  if (!hasLeaderPrivileges(club, req.user.id)) {
    throw new AppError('Only the leader or a co-leader can handle requests', 403);
  }

  const request = orNotFound(club.joinRequests.id(requestId), 'Request not found');
  request.status = status;

  // If accepted, add user to members (if not already a member and space is available)
  if (status === 'accepted' && !isClubMember(club, request.user)) {
    assertHasRoom(club, 'Club is full');
    club.members.push(request.user);
  }

  await club.save();

  // Notify the requesting user of the decision
  const accepted = status === 'accepted';
  notify(request.user.toString(), {
    type: accepted ? 'JOIN_ACCEPTED' : 'JOIN_REJECTED',
    message: accepted
      ? `Your request to join "${club.name}" was accepted!`
      : `Your request to join "${club.name}" was declined.`,
    data: { clubId: club._id }
  });

  // Send email confirmation to the requesting user
  const requestingUser = await User.findById(request.user).select('email');
  if (requestingUser?.email) {
    const joinTpl = accepted
      ? emailTemplates.joinRequestAccepted({ clubName: club.name })
      : emailTemplates.joinRequestRejected({ clubName: club.name });
    sendEmail({ to: requestingUser.email, ...joinTpl });
  }

  res.json({ success: true, message: `Request ${status}` });
});

/**
 * Leave a Club
 * @route PUT /api/clubs/:clubId/leave
 * @access Private
 */
const leaveClub = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const club = orNotFound(await Club.findById(req.params.clubId), 'Club not found');

  if (!isClubMember(club, userId)) {
    throw new AppError('You are not a member of this club', 400);
  }

  // Prevent the leader from leaving (they must transfer ownership or delete the club)
  if (isClubLeader(club, userId)) {
    throw new AppError('The club leader cannot leave. Please transfer ownership or delete the club.', 400);
  }

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
  const userId = req.user.id;

  if (!newLeaderId) throw new AppError('newLeaderId is required', 400);

  const club = orNotFound(await Club.findById(clubId), 'Club not found');

  if (!isClubLeader(club, userId)) {
    throw new AppError('Only the current leader can transfer ownership', 403);
  }

  if (newLeaderId === userId) {
    throw new AppError('You are already the leader', 400);
  }

  if (!isClubMember(club, newLeaderId)) {
    throw new AppError('The new leader must already be a member of the club', 400);
  }

  club.leader = newLeaderId;
  // The new leader is redundant as a co-leader now — clear it if present.
  club.coLeaders = club.coLeaders.filter((id) => id.toString() !== newLeaderId);
  await club.save();

  const updated = await Club.findById(clubId)
    .populate('leader', 'username email avatar name useDisplayName')
    .populate('members', MEMBER_FIELDS)
    .populate('coLeaders', MEMBER_FIELDS)
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
  // UC-32 — optional: also ban this user from rejoining. Defaults to false
  // (unchecked), so a plain removal behaves exactly as it always has.
  const { ban } = req.body;
  const userId = req.user.id;

  const club = orNotFound(await Club.findById(clubId), 'Club not found');

  if (!hasLeaderPrivileges(club, userId)) {
    throw new AppError('Only the club leader or a co-leader can remove members', 403);
  }

  if (isClubLeader(club, memberId)) {
    throw new AppError('Cannot remove the club leader', 400);
  }

  const targetIsCoLeader = isClubCoLeader(club, memberId);
  if (targetIsCoLeader && !isClubLeader(club, userId)) {
    throw new AppError('Only the club leader can remove a co-leader', 403);
  }

  if (!isClubMember(club, memberId)) {
    throw new AppError('User is not a member of this club', 400);
  }

  club.members = club.members.filter((m) => m.toString() !== memberId);
  // Removing a co-leader from the club also ends their co-leader status —
  // you can't be a co-leader of a club you're not a member of.
  if (targetIsCoLeader) {
    club.coLeaders = club.coLeaders.filter((id) => id.toString() !== memberId);
  }
  if (ban === true && !club.bannedUsers.some((id) => id.toString() === memberId)) {
    club.bannedUsers.push(memberId);
  }
  await club.save();

  res.json({ success: true, message: 'Member removed successfully' });
});

/**
 * List a Club's Banned Users (UC-32)
 * @route GET /api/clubs/:clubId/banned
 * @access Private (Club Leaders/Co-Leaders only)
 */
const getBannedMembers = asyncHandler(async (req, res) => {
  const club = orNotFound(
    await Club.findById(req.params.clubId).populate('bannedUsers', 'username avatar name useDisplayName'),
    'Club not found'
  );
  if (!hasLeaderPrivileges(club, req.user.id)) {
    throw new AppError('Only the club leader or a co-leader can view banned members', 403);
  }

  res.json({ success: true, bannedUsers: club.bannedUsers });
});

/**
 * Unban a Previously-Removed User (UC-32)
 * @route DELETE /api/clubs/:clubId/banned/:userId
 * @access Private (Club Leaders/Co-Leaders only)
 */
const unbanMember = asyncHandler(async (req, res) => {
  const { clubId, userId: targetUserId } = req.params;

  const club = orNotFound(await Club.findById(clubId), 'Club not found');
  if (!hasLeaderPrivileges(club, req.user.id)) {
    throw new AppError('Only the club leader or a co-leader can unban members', 403);
  }

  const wasBanned = club.bannedUsers.some((id) => id.toString() === targetUserId);
  if (!wasBanned) throw new AppError('That user is not banned from this club', 400);

  club.bannedUsers = club.bannedUsers.filter((id) => id.toString() !== targetUserId);
  await club.save();

  res.json({ success: true, message: 'User unbanned successfully' });
});

/**
 * Promote a Member to Co-Leader (UC-10)
 * @route PUT /api/clubs/:clubId/promote
 * @access Private (Club Leader only)
 */
const promoteCoLeader = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { userId: targetUserId } = req.body;

  if (!targetUserId) throw new AppError('userId is required', 400);

  const club = orNotFound(await Club.findById(clubId), 'Club not found');

  if (!isClubLeader(club, req.user.id)) {
    throw new AppError('Only the club leader can promote a co-leader', 403);
  }

  if (isClubLeader(club, targetUserId)) {
    throw new AppError('The leader cannot be promoted to co-leader', 400);
  }

  if (!isClubMember(club, targetUserId)) {
    throw new AppError('User must be a member of this club to be promoted', 400);
  }

  if (isClubCoLeader(club, targetUserId)) {
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
    .populate('coLeaders', MEMBER_FIELDS)
    .lean();

  res.json({ success: true, message: 'Member promoted to co-leader', club: updated });
});

/**
 * Demote a Co-Leader back to Regular Member (UC-10)
 * @route PUT /api/clubs/:clubId/demote
 * @access Private (Club Leader only)
 */
const demoteCoLeader = asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.body;

  if (!targetUserId) throw new AppError('userId is required', 400);

  const club = orNotFound(await Club.findById(req.params.clubId), 'Club not found');

  if (!isClubLeader(club, req.user.id)) {
    throw new AppError('Only the club leader can demote a co-leader', 403);
  }

  if (!isClubCoLeader(club, targetUserId)) {
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

/**
 * Block a Club — the reciprocal of a leader/co-leader's ban (any user can
 * do this to any club, member or not; leaders have no say in it). Hides the
 * club from browse/search and blocks future joins for the blocking user
 * only, until unblocked. Only offered on clubs the user isn't currently a
 * member of — leave first (existing Leave Club flow) if you belong to it.
 * @route POST /api/clubs/:clubId/block
 * @access Private
 */
const blockClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const userId = req.user.id;

  const club = orNotFound(await Club.findById(clubId).select('members'), 'Club not found');

  if (isClubMember(club, userId)) {
    throw new AppError('Leave this club before blocking it.', 400);
  }

  await User.updateOne({ _id: userId }, { $addToSet: { blockedClubs: clubId } });
  res.json({ success: true, message: 'Club blocked.' });
});

/**
 * Unblock a previously-blocked club.
 * @route DELETE /api/clubs/:clubId/block
 * @access Private
 */
const unblockClub = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { blockedClubs: req.params.clubId } });
  res.json({ success: true, message: 'Club unblocked.' });
});

/**
 * List the requesting user's blocked clubs.
 * @route GET /api/clubs/blocked
 * @access Private
 */
const getBlockedClubs = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate('blockedClubs', 'name description location avatar')
    .select('blockedClubs')
    .lean();

  res.json({ success: true, blockedClubs: user?.blockedClubs || [] });
});

module.exports = {
  requestToJoinClub,
  joinClubByInviteCode,
  handleJoinRequest,
  leaveClub,
  transferOwnership,
  removeMember,
  getBannedMembers,
  unbanMember,
  promoteCoLeader,
  demoteCoLeader,
  blockClub,
  unblockClub,
  getBlockedClubs,
};
