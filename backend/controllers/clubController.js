// Clubs themselves: create, read, search/browse (incl. UC-46 proximity),
// trending, edit, and delete. Membership (joining, leaving, roles, bans,
// blocks) lives in clubMembershipController; announcements in
// clubAnnouncementController.

const Club = require('../models/club');
const Drive = require('../models/drive');
const User = require('../models/user');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { escapeRegex } = require('../utils/regex');
const { isClubLeader } = require('../utils/clubPermissions');
const { parsePageParams, paginationMeta } = require('../utils/pagination');
const { METERS_PER_MILE, validateCoordinates, toGeoPoint, parseProximityQuery, roundMiles } = require('../utils/geo');
const { deleteClubsCascade } = require('../services/clubCascade');
const { CLUB_TAGS } = Club;

/**
 * Create a new Club
 * @route POST /api/clubs
 * @access Private
 */
const createClub = asyncHandler(async (req, res) => {
  const { name, description, location, maxMembers, isPrivate, tags, coordinates } = req.body;
  const userId = req.user.id;
  validateCoordinates(coordinates);

  const existingClub = await Club.findOne({ name });
  if (existingClub) {
    throw new AppError('A club with this name already exists', 400);
  }

  const club = await Club.create({
    name,
    description,
    location: location || '',
    // UC-46 search point — only alongside a place name to explain it
    geo: coordinates && location ? toGeoPoint(coordinates) : undefined,
    maxMembers: maxMembers || null,
    isPrivate: isPrivate === true,
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
  const clubs = await Club.find({ members: req.user.id })
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

  const club = orNotFound(
    await Club.findById(clubId)
      .populate('leader', 'username email avatar name useDisplayName cars')
      .populate('members', 'username email avatar name useDisplayName cars')
      .populate('coLeaders', 'username email avatar name useDisplayName cars')
      .populate('joinRequests.user', 'username email avatar name useDisplayName')
      .lean(),
    'Club not found'
  );

  // A blocked club is excluded from search, but is still reachable by direct
  // link (a bookmark, a shared URL) — the frontend needs to know whether the
  // viewer has blocked it to render the correct Block/Unblock affordance,
  // mirroring getPublicProfile's isBlockedByViewer (UC-32's user-block feature).
  const requestingUser = await User.findById(req.user.id).select('blockedClubs').lean();
  const isBlockedByViewer = (requestingUser?.blockedClubs || []).some((id) => id.toString() === clubId);

  res.json({ success: true, club, isBlockedByViewer });
});

/**
 * Get Club by Invite Code
 * @route GET /api/clubs/invite/:inviteCode
 * @access Private
 */
const getClubByInviteCode = asyncHandler(async (req, res) => {
  // A valid invite code only proves the requester was given the code by
  // someone — not that they're a member. Email is left out of this preview
  // (unlike getClubById, which is reached only after actually joining/being
  // a member) so guessing/leaking a code can't be used to harvest members'
  // email addresses off a private club.
  const club = orNotFound(
    await Club.findOne({ inviteCode: req.params.inviteCode })
      .populate('leader', 'username avatar name useDisplayName cars')
      .populate('members', 'username avatar name useDisplayName cars')
      .lean(),
    'Club not found'
  );

  res.json({ success: true, club });
});

/**
 * Search Clubs
 * @route GET /api/clubs/browse
 * @access Private
 * @note  With `lat`+`lng` (and optional `radius` in miles, default 25) this
 *        becomes a proximity search (UC-46): only geocoded clubs inside the
 *        radius, nearest first, each carrying a `distanceMiles`.
 */
const searchClubs = asyncHandler(async (req, res) => {
  const { query, tags } = req.query;
  const proximity = parseProximityQuery(req.query);
  const paging = parsePageParams(req.query);

  // Clubs this user has blocked never surface in browse/search results
  // (UC-32's reciprocal user-blocks-club feature) — the same route a leader
  // ban is enforced at join time, not discovery time, since a ban is about
  // preventing rejoining, not about hiding the club from view.
  const requestingUser = await User.findById(req.user.id).select('blockedClubs').lean();
  const blockedClubIds = requestingUser?.blockedClubs || [];

  const searchQuery = { isPrivate: false };
  if (blockedClubIds.length > 0) {
    searchQuery._id = { $nin: blockedClubIds };
  }
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

  let clubs;
  let total;
  if (proximity) {
    // $geoNear has to be the first pipeline stage. It applies the same
    // privacy/blocked/text/tag filters, drops clubs outside the radius, and
    // sorts nearest-first in one pass; $facet then pages it and counts the
    // full match set.
    const [result] = await Club.aggregate([
      {
        $geoNear: {
          near: toGeoPoint(proximity.center),
          key: 'geo',
          distanceField: 'distanceMeters',
          maxDistance: proximity.radiusMiles * METERS_PER_MILE,
          query: searchQuery,
          spherical: true,
        },
      },
      {
        $facet: {
          clubs: [{ $skip: paging.skip }, { $limit: paging.limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const withDistance = result.clubs.map(({ distanceMeters, ...club }) => ({
      ...club,
      distanceMiles: roundMiles(distanceMeters / METERS_PER_MILE),
    }));
    clubs = await Club.populate(withDistance, { path: 'leader', select: 'username email' });
    total = result.total[0]?.count || 0;
  } else {
    [clubs, total] = await Promise.all([
      Club.find(searchQuery)
        .populate('leader', 'username email')
        .sort({ createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Club.countDocuments(searchQuery),
    ]);
  }

  res.json({
    success: true,
    clubs,
    pagination: paginationMeta(paging, total, clubs.length),
  });
});

/**
 * Get Top Club by Member Count and Completed Drives
 * @route GET /api/clubs/trending
 * @access Private
 */
const getTopClub = asyncHandler(async (req, res) => {
  const clubs = await Club.find({ isPrivate: false })
    .populate('leader', 'username email avatar name')
    .limit(100);

  if (!clubs.length) {
    return res.json({ success: true, club: null });
  }

  // One aggregation for every candidate's completed-drive count, not one
  // countDocuments per club
  const driveCounts = await Drive.aggregate([
    { $match: { club: { $in: clubs.map(c => c._id) }, isCompleted: true } },
    { $group: { _id: '$club', completedDrivesCount: { $sum: 1 } } }
  ]);
  const driveCountMap = new Map(
    driveCounts.map(d => [d._id.toString(), d.completedDrivesCount])
  );

  let topClubData = null;
  for (const club of clubs) {
    const completedDrivesCount = driveCountMap.get(club._id.toString()) || 0;
    const trendingScore = club.members.length + (completedDrivesCount * 5);

    if (!topClubData || trendingScore > topClubData.trendingScore) {
      topClubData = { club, memberCount: club.members.length, completedDrivesCount, trendingScore };
    }
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
 * Update a Club (Edit name, description, avatar)
 * @route PUT /api/clubs/:clubId
 * @access Private (Club Leaders only)
 */
const updateClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { name, description, location, avatar, isPrivate, tags, coordinates } = req.body;
  validateCoordinates(coordinates);

  const club = orNotFound(await Club.findById(clubId), 'Club not found');

  if (!isClubLeader(club, req.user.id)) {
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

  if (description !== undefined) club.description = description;
  const locationChanged = location !== undefined && location !== club.location;
  if (location !== undefined) club.location = location;
  // Keep the UC-46 search point in step with the place name. An explicit
  // `coordinates` wins; otherwise retyping the location (e.g. from the mobile
  // client, which doesn't send coordinates) drops the now-stale point rather
  // than leaving the club findable near its old city.
  if (coordinates) club.geo = toGeoPoint(coordinates);
  else if (coordinates === null || locationChanged) club.geo = undefined;
  if (!club.location) club.geo = undefined;
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
 * Toggle Club Privacy
 * @route POST /api/clubs/:clubId/toggle-privacy
 * @access Private (Club Leaders only)
 */
const toggleClubPrivacy = asyncHandler(async (req, res) => {
  const { isPrivate } = req.body;

  const club = orNotFound(await Club.findById(req.params.clubId), 'Club not found');

  if (!isClubLeader(club, req.user.id)) {
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
 * Delete a Club
 * @route DELETE /api/clubs/:clubId
 * @access Private (Club Leaders only)
 */
const deleteClub = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { deletionReason, leaderEmail } = req.body;

  const club = orNotFound(await Club.findById(clubId).populate('leader', 'email username'), 'Club not found');

  if (!isClubLeader(club, req.user.id)) {
    throw new AppError('Only the club leader can delete this club', 403);
  }

  // Verify the provided email matches the leader's email
  if (!leaderEmail || club.leader.email.toLowerCase() !== leaderEmail.toLowerCase()) {
    throw new AppError("Email does not match the registered group leader's email", 403);
  }

  logger.info('Club deleted', { clubId, clubName: club.name, reason: deletionReason || null, deletedBy: req.user.id });

  await deleteClubsCascade([club._id]);

  res.json({ success: true, message: 'Club deleted successfully' });
});

module.exports = {
  createClub,
  getUserClubs,
  getClubById,
  getClubByInviteCode,
  searchClubs,
  getTopClub,
  updateClub,
  toggleClubPrivacy,
  deleteClub,
};
