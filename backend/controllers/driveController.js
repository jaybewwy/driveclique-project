const Drive = require('../models/drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const DriveRating = require('../models/driveRating');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { sendEmail, emailTemplates } = require('../services/emailService');

// Shared validation for the optional drive meeting-point pin (UC-23)
function validateCoordinates(coordinates) {
  if (!coordinates) return;
  const { lat, lng } = coordinates;
  if (
    typeof lat !== 'number' || typeof lng !== 'number' ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180
  ) {
    throw new AppError('Invalid coordinates', 400);
  }
}

/**
 * Create a new Drive/Event
 * @route POST /api/drives
 * @access Private (Club Leaders only)
 */
const createDrive = asyncHandler(async (req, res) => {
  const { clubId, name, date, time, location, description, difficulty, maxAttendees, image, coordinates } = req.body;
  validateCoordinates(coordinates);

  // Validate clubId is provided
  if (!clubId) {
    throw new AppError('clubId is required. You must create or select a club first.', 400);
  }

  // Verify club exists
  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Verify user is the club leader
  if (club.leader.toString() !== req.user.id) {
    throw new AppError('Only the club leader can create drives for this club', 403);
  }

  // Validate drive date is in the future
  if (!date || new Date(date) <= new Date()) {
    throw new AppError('Drive date must be in the future', 400);
  }

  // Create the drive
  const newDrive = new Drive({
    club: clubId,
    name,
    date,
    time,
    location,
    coordinates: coordinates || undefined,
    description,
    difficulty: difficulty || 'Medium',
    maxAttendees: maxAttendees || 100,
    image: image || '',
    createdBy: req.user.id
  });

  await newDrive.save();

  // Notify all club members about the new drive (SSE + email)
  const driveClub = await Club.findById(clubId).select('members');
  if (driveClub) {
    // Only email members with a verified email (emailVerified !== false preserves existing accounts)
    const verifiedMembers = await User.find({
      _id: { $in: driveClub.members },
      emailVerified: { $ne: false }
    }).select('_id email');
    const emailMap = new Map(verifiedMembers.map(m => [m._id.toString(), m.email]));

    const dateStr = new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const tpl = emailTemplates.driveScheduled({ driveName: name, clubName: club.name, date: dateStr, location });

    driveClub.members.forEach(memberId => {
      if (memberId.toString() !== req.user.id) {
        notify(memberId.toString(), { type: 'NEW_DRIVE', message: `New drive scheduled: "${name}"`, data: { driveId: newDrive._id, clubId } });
        const email = emailMap.get(memberId.toString());
        if (email) sendEmail({ to: email, ...tpl });
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Drive created successfully!',
    drive: newDrive
  });
});

/**
 * Get all drives for a specific club
 * @route GET /api/drives/club/:clubId
 * @access Private
 */
const getClubDrives = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const { page, limit } = req.query;

  // If page/limit are provided, paginate; otherwise return all (backwards-compatible)
  if (page !== undefined || limit !== undefined) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [drives, total] = await Promise.all([
      Drive.find({ club: clubId })
        .sort({ date: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'username name'),
      Drive.countDocuments({ club: clubId }),
    ]);

    return res.json({
      success: true,
      drives,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + drives.length < total,
      },
    });
  }

  const drives = await Drive.find({ club: clubId })
    .sort({ date: 1 })
    .populate('createdBy', 'username name');

  res.json({ success: true, drives });
});

/**
 * RSVP to a Drive / Change RSVP Status
 * @route POST /api/drives/:driveId/rsvp
 * @access Private
 */
const rsvpToDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  // Validate RSVP status
  const validStatuses = ['going', 'maybe', 'not-going'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid RSVP status. Must be: going, maybe, or not-going', 400);
  }

  // Verify drive exists
  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is a member of the club that owns this drive
  const club = await Club.findById(drive.club).select('members name');
  if (!club) {
    throw new AppError('Club not found', 404);
  }
  if (!club.members.some(m => m.toString() === userId)) {
    throw new AppError('You must be a member of this club to RSVP', 403);
  }

  // Fetch existing RSVP once — used by both the capacity check and the update path
  let rsvp = await RSVP.findOne({ drive: driveId, user: userId });
  const oldStatus = rsvp?.status ?? null;

  // ---------- PATH A: drive is full and user wants 'going' ----------
  if (status === 'going' && drive.maxAttendees && oldStatus !== 'going') {
    const goingCount = await RSVP.countDocuments({ drive: driveId, status: 'going' });
    if (goingCount >= drive.maxAttendees) {
      // Already on the waitlist — return current position without creating a duplicate
      if (oldStatus === 'waitlisted') {
        const position = await RSVP.countDocuments({
          drive: driveId, status: 'waitlisted', createdAt: { $lt: rsvp.createdAt }
        }) + 1;
        return res.json({ success: true, waitlisted: true, position, message: `You are #${position} on the waitlist`, rsvp });
      }

      // Enroll in the waitlist
      if (rsvp) {
        rsvp.status = 'waitlisted';
        await rsvp.save();
      } else {
        rsvp = await RSVP.create({ drive: driveId, user: userId, status: 'waitlisted' });
      }
      const position = await RSVP.countDocuments({
        drive: driveId, status: 'waitlisted', createdAt: { $lt: rsvp.createdAt }
      }) + 1;
      notify(userId, {
        type: 'WAITLIST_JOINED',
        message: `You joined the waitlist for "${drive.name}" at position #${position}`,
        data: { driveId, position }
      });
      return res.json({ success: true, waitlisted: true, position, message: `You joined the waitlist at position #${position}`, rsvp });
    }
  }

  // ---------- PATH B / PATH C: update an existing RSVP ----------
  if (rsvp) {
    rsvp.status = status;
    await rsvp.save();

    // PATH B: a confirmed 'going' spot just freed — promote the next waitlisted member
    if (oldStatus === 'going' && status !== 'going') {
      const nextInLine = await RSVP.findOne({ drive: driveId, status: 'waitlisted' }).sort({ createdAt: 1 });
      if (nextInLine) {
        nextInLine.status = 'going';
        await nextInLine.save();
        notify(nextInLine.user.toString(), {
          type: 'WAITLIST_PROMOTED',
          message: `A spot opened up — you're now confirmed for "${drive.name}"!`,
          data: { driveId }
        });
        const promoted = await User.findById(nextInLine.user).select('email emailVerified');
        if (promoted?.emailVerified !== false) {
          const tpl = emailTemplates.waitlistPromoted({
            driveName: drive.name,
            clubName: club.name,
            driveDate: new Date(drive.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          });
          sendEmail({ to: promoted.email, ...tpl });
        }
      }
    }

    if (drive.createdBy) {
      notify(drive.createdBy.toString(), {
        type: 'RSVP_UPDATED',
        message: `A member updated their RSVP to "${status}" for "${drive.name}"`,
        data: { driveId, status }
      });
    }
    return res.json({ success: true, message: `RSVP updated to ${status}`, rsvp });
  }

  // ---------- New RSVP (drive has space, or status is 'maybe'/'not-going') ----------
  rsvp = new RSVP({ drive: driveId, user: userId, status });
  await rsvp.save();

  if (drive.createdBy) {
    notify(drive.createdBy.toString(), {
      type: 'RSVP_NEW',
      message: `A member RSVPed "${status}" to "${drive.name}"`,
      data: { driveId, status }
    });
  }

  res.json({ success: true, message: `You are now marked as ${status}`, rsvp });
});

/**
 * Cancel a Drive
 * @route POST /api/drives/:driveId/cancel
 * @access Private (Club Leaders only)
 */
const cancelDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { cancellationReason } = req.body;
  const leaderId = req.user.id;

  // Validate cancellation reason
  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new AppError('Cancellation reason is required', 400);
  }

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can cancel this drive', 403);
  }

  // Update drive cancellation fields
  drive.isCancelled = true;
  drive.cancellationReason = cancellationReason.trim();
  drive.cancelledAt = new Date();
  drive.cancelledBy = leaderId;

  await drive.save();

  // Notify club members about the cancellation (SSE + email)
  const cancelVerifiedMembers = await User.find({
    _id: { $in: drive.club.members },
    emailVerified: { $ne: false }
  }).select('_id email');
  const cancelEmailMap = new Map(cancelVerifiedMembers.map(m => [m._id.toString(), m.email]));
  const cancelTpl = emailTemplates.driveCancelled({
    driveName: drive.name,
    clubName: drive.club.name,
    reason: cancellationReason.trim()
  });
  drive.club.members.forEach(memberId => {
    if (memberId.toString() !== leaderId) {
      notify(memberId.toString(), {
        type: 'DRIVE_CANCELLED',
        message: `Drive "${drive.name}" has been cancelled`,
        data: { driveId, clubId: drive.club._id }
      });
      const cancelEmail = cancelEmailMap.get(memberId.toString());
      if (cancelEmail) sendEmail({ to: cancelEmail, ...cancelTpl });
    }
  });

  res.json({
    success: true,
    message: 'Drive has been cancelled successfully',
    drive
  });
});

/**
 * Get RSVP Counts + Current User's RSVP Status for a Drive
 * @route GET /api/drives/:driveId/rsvp-status
 * @access Private (any authenticated club member)
 */
const getDriveRSVPStatus = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  // Verify drive exists
  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is a member of the club that owns this drive
  const rsvpClub = await Club.findById(drive.club).select('members');
  if (!rsvpClub) {
    throw new AppError('Club not found', 404);
  }
  if (!rsvpClub.members.some(m => m.toString() === userId)) {
    throw new AppError('You must be a member of this club to view RSVP data', 403);
  }

  // Fetch all RSVPs for this drive (include createdAt for waitlist position calculation)
  const rsvps = await RSVP.find({ drive: driveId })
    .select('user status createdAt checkedIn')
    .lean();

  // Calculate counts in a single pass
  const counts = rsvps.reduce(
    (acc, r) => {
      if (r.status === 'going') acc.going++;
      else if (r.status === 'maybe') acc.maybe++;
      else if (r.status === 'not-going') acc.notGoing++;
      else if (r.status === 'waitlisted') acc.waitlisted++;
      return acc;
    },
    { going: 0, maybe: 0, notGoing: 0, waitlisted: 0 }
  );

  // Check-in counts among 'going' RSVPs only
  const checkin = rsvps.reduce(
    (acc, r) => {
      if (r.status !== 'going') return acc;
      if (r.checkedIn === 'present') acc.present++;
      else if (r.checkedIn === 'not-present') acc.notPresent++;
      else acc.pending++;
      return acc;
    },
    { present: 0, notPresent: 0, pending: 0 }
  );

  // Find the requesting user's own RSVP (if any)
  const userRSVP = rsvps.find(r => r.user.toString() === userId);

  // Derive waitlist position from createdAt ordering (no stored field needed)
  let waitlistPosition = null;
  if (userRSVP?.status === 'waitlisted') {
    waitlistPosition = rsvps.filter(r =>
      r.status === 'waitlisted' &&
      new Date(r.createdAt) < new Date(userRSVP.createdAt)
    ).length + 1;
  }

  res.json({
    success: true,
    counts,
    checkin,
    checkInRequestedAt: drive.checkInRequestedAt || null,
    userStatus: userRSVP ? userRSVP.status : null,
    waitlistPosition,
    totalRSVPs: rsvps.length
  });
});

/**
 * Get Drive Attendees and Stats
 * @route GET /api/drives/:driveId/attendees
 * @access Private (Club Leaders only)
 */
const getDriveAttendees = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== userId) {
    throw new AppError('Only the club leader can view the attendees of this drive', 403);
  }

  // Get all RSVPs with user info in a single query
  const rsvps = await RSVP.find({ drive: driveId })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });

  // Calculate stats using reduce for better efficiency
  const stats = rsvps.reduce((acc, r) => {
    if (r.status === 'going') acc.going++;
    else if (r.status === 'maybe') acc.maybe++;
    else if (r.status === 'not-going') acc.notGoing++;
    return acc;
  }, { going: 0, maybe: 0, notGoing: 0 });

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
      going: stats.going,
      maybe: stats.maybe,
      notGoing: stats.notGoing,
      totalSpots: drive.maxAttendees,
      spotsLeft: Math.max(0, drive.maxAttendees - stats.going)
    },
    rsvps
  });
});

/**
 * Update a Drive (Edit details or mark as complete)
 * @route PUT /api/drives/:driveId
 * @access Private (Club Leaders only)
 */
const updateDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { name, date, time, location, description, difficulty, maxAttendees, isCompleted, image, coordinates } = req.body;
  const leaderId = req.user.id;
  validateCoordinates(coordinates);

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can update this drive', 403);
  }

  // Update fields if provided
  if (name !== undefined) drive.name = name;
  if (date !== undefined) drive.date = date;
  if (time !== undefined) drive.time = time;
  if (location !== undefined) drive.location = location;
  if (coordinates !== undefined) drive.coordinates = coordinates || undefined;
  if (description !== undefined) drive.description = description;
  if (difficulty !== undefined) drive.difficulty = difficulty;
  if (maxAttendees !== undefined) drive.maxAttendees = maxAttendees;
  if (image !== undefined) drive.image = image;

  // Handle completion status
  if (isCompleted !== undefined) {
    if (isCompleted) {
      drive.isCompleted = true;
      drive.completedAt = new Date();
    } else {
      drive.isCompleted = false;
      drive.completedAt = undefined;
    }
  }

  await drive.save();

  res.json({
    success: true,
    message: 'Drive updated successfully',
    drive
  });
});

/**
 * Delete a Drive
 * @route DELETE /api/drives/:driveId
 * @access Private (Club Leaders only)
 */
const deleteDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const leaderId = req.user.id;

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can delete this drive', 403);
  }

  // Delete the drive
  await Drive.findByIdAndDelete(driveId);

  // Also delete associated RSVPs
  await RSVP.deleteMany({ drive: driveId });

  res.json({
    success: true,
    message: 'Drive deleted successfully'
  });
});

/**
 * Get Leader Dashboard Summary
 * @route GET /api/drives/dashboard
 * @access Private (Club Leaders only)
 * 
 * OPTIMIZED: Uses aggregation pipeline to reduce N+1 queries
 */
const getLeaderDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Find all clubs where user is the leader
  const clubs = await Club.find({ leader: userId })
    .select('name description inviteCode members createdAt')
    .lean(); // Use lean() for better performance (read-only objects)

  if (clubs.length === 0) {
    return res.json({
      success: true,
      totalClubs: 0,
      dashboard: []
    });
  }

  const clubIds = clubs.map(club => club._id);

  // Get all drives for these clubs in a single query
  const drives = await Drive.find({ club: { $in: clubIds } })
    .select('_id club name date time location isCancelled maxAttendees')
    .sort({ date: 1 })
    .lean();

  // Get all RSVPs for these drives in a single query
  const driveIds = drives.map(drive => drive._id);
  const rsvps = await RSVP.find({ drive: { $in: driveIds } })
    .select('drive status')
    .lean();

  // Build a map of drive stats for O(1) lookup
  const driveStatsMap = new Map();
  rsvps.forEach(rsvp => {
    const driveIdStr = rsvp.drive.toString();
    if (!driveStatsMap.has(driveIdStr)) {
      driveStatsMap.set(driveIdStr, { going: 0, maybe: 0, notGoing: 0, total: 0 });
    }
    const stats = driveStatsMap.get(driveIdStr);
    stats.total++;
    if (rsvp.status === 'going') stats.going++;
    else if (rsvp.status === 'maybe') stats.maybe++;
    else if (rsvp.status === 'not-going') stats.notGoing++;
  });

  // Build the dashboard response
  const dashboard = clubs.map(club => {
    const clubDrives = drives.filter(d => d.club.toString() === club._id.toString());
    
    const driveSummaries = clubDrives.map(drive => {
      const stats = driveStatsMap.get(drive._id.toString()) || { going: 0, maybe: 0, notGoing: 0, total: 0 };
      
      return {
        _id: drive._id,
        name: drive.name,
        date: drive.date,
        time: drive.time,
        location: drive.location,
        isCancelled: drive.isCancelled || false,
        rsvpStats: {
          going: stats.going,
          maybe: stats.maybe,
          notGoing: stats.notGoing,
          totalRSVPs: stats.total,
          spotsLeft: Math.max(0, drive.maxAttendees - stats.going)
        }
      };
    });

    return {
      club: {
        _id: club._id,
        name: club.name,
        inviteCode: club.inviteCode,
        memberCount: club.members.length
      },
      drives: driveSummaries,
      totalDrives: driveSummaries.length
    };
  });

  res.json({
    success: true,
    totalClubs: dashboard.length,
    dashboard
  });
});

/**
 * Get current user's RSVP history across all clubs
 * @route GET /api/drives/my-rsvps
 * @access Private
 */
const getMyRSVPs = asyncHandler(async (req, res) => {
  const rsvps = await RSVP.find({ user: req.user.id })
    .populate({
      path: 'drive',
      select: 'name date time location isCancelled isCompleted club',
      populate: { path: 'club', select: 'name _id' }
    })
    .sort({ createdAt: -1 })
    .lean();

  // Drop any RSVPs whose drive was hard-deleted
  const valid = rsvps.filter(r => r.drive);

  res.json({ success: true, rsvps: valid });
});

/**
 * Get Club Analytics for Leader
 * @route GET /api/drives/analytics
 * @access Private (Club Leaders only)
 */
const getClubAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Batch query 1: all clubs led by this user
  const clubs = await Club.find({ leader: userId })
    .select('name members')
    .lean();

  if (clubs.length === 0) {
    return res.json({ success: true, analytics: [] });
  }

  const clubIds = clubs.map(c => c._id);

  // Batch query 2: all drives for those clubs
  const drives = await Drive.find({ club: { $in: clubIds } })
    .select('_id club name date isCompleted isCancelled maxAttendees checkInRequestedAt')
    .lean();

  const driveIds = drives.map(d => d._id);

  // Batch query 3: all going RSVPs for those drives
  const rsvps = await RSVP.find({ drive: { $in: driveIds }, status: 'going' })
    .select('drive user checkedIn')
    .lean();

  // Batch query 3b: all drive ratings for those drives
  const ratings = await DriveRating.find({ drive: { $in: driveIds } })
    .select('drive stars')
    .lean();

  // Batch query 4: user info for most active member display
  const rsvpUserIds = [...new Set(rsvps.map(r => r.user.toString()))];
  const users = await User.find({ _id: { $in: rsvpUserIds } })
    .select('username name')
    .lean();

  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  // Build driveRatingMap: driveId -> { sum, count }
  const driveRatingMap = new Map();
  ratings.forEach(rating => {
    const driveStr = rating.drive.toString();
    if (!driveRatingMap.has(driveStr)) {
      driveRatingMap.set(driveStr, { sum: 0, count: 0 });
    }
    const entry = driveRatingMap.get(driveStr);
    entry.sum += rating.stars;
    entry.count++;
  });

  // Build driveGoingMap: driveId -> { count, present, userIds[] }
  const driveGoingMap = new Map();
  rsvps.forEach(rsvp => {
    const driveStr = rsvp.drive.toString();
    if (!driveGoingMap.has(driveStr)) {
      driveGoingMap.set(driveStr, { count: 0, present: 0, userIds: [] });
    }
    const entry = driveGoingMap.get(driveStr);
    entry.count++;
    if (rsvp.checkedIn === 'present') entry.present++;
    entry.userIds.push(rsvp.user.toString());
  });

  // Compute analytics per club using in-memory Maps (no N+1)
  const analytics = clubs.map(club => {
    const clubIdStr = club._id.toString();
    const clubDrives = drives.filter(d => d.club.toString() === clubIdStr);
    const memberCount = club.members.length;

    const totalDrives = clubDrives.length;
    const completedDrives = clubDrives.filter(d => d.isCompleted).length;
    const cancelledDrives = clubDrives.filter(d => d.isCancelled).length;
    const completionRate = totalDrives > 0
      ? Math.round((completedDrives / totalDrives) * 100)
      : 0;

    // avgRSVPRate: average of (goingCount / memberCount) per non-cancelled drive
    const activeDrives = clubDrives.filter(d => !d.isCancelled);
    let avgRSVPRate = 0;
    if (activeDrives.length > 0 && memberCount > 0) {
      const totalRate = activeDrives.reduce((sum, drive) => {
        const goingCount = driveGoingMap.get(drive._id.toString())?.count || 0;
        return sum + goingCount / memberCount;
      }, 0);
      avgRSVPRate = Math.round((totalRate / activeDrives.length) * 100);
    }

    // mostPopularDrive: non-cancelled drive with highest going RSVP count
    let mostPopularDrive = null;
    let maxGoing = 0;
    activeDrives.forEach(drive => {
      const goingCount = driveGoingMap.get(drive._id.toString())?.count || 0;
      if (goingCount > maxGoing) {
        maxGoing = goingCount;
        mostPopularDrive = { name: drive.name, date: drive.date, goingCount };
      }
    });

    // mostActiveMember: member with most going RSVPs across all this club's drives
    const memberRSVPCount = new Map();
    clubDrives.forEach(drive => {
      const goingUsers = driveGoingMap.get(drive._id.toString())?.userIds || [];
      goingUsers.forEach(uid => {
        memberRSVPCount.set(uid, (memberRSVPCount.get(uid) || 0) + 1);
      });
    });

    let mostActiveMember = null;
    let maxRSVPs = 0;
    memberRSVPCount.forEach((count, uid) => {
      if (count > maxRSVPs) {
        maxRSVPs = count;
        const u = userMap.get(uid);
        if (u) mostActiveMember = { username: u.username, name: u.name, rsvpCount: count };
      }
    });

    // avgAttendanceRate: average of (present / going) across drives where check-in was used
    const checkedInDrives = clubDrives.filter(d => d.checkInRequestedAt);
    let avgAttendanceRate = null;
    if (checkedInDrives.length > 0) {
      const totalRate = checkedInDrives.reduce((sum, drive) => {
        const entry = driveGoingMap.get(drive._id.toString());
        if (!entry || entry.count === 0) return sum;
        return sum + entry.present / entry.count;
      }, 0);
      avgAttendanceRate = Math.round((totalRate / checkedInDrives.length) * 100);
    }

    // avgDriveRating: average of each rated drive's own average star value,
    // over drives that have at least one rating (null if the club has never been rated)
    const ratedDrives = clubDrives.filter(d => driveRatingMap.has(d._id.toString()));
    let avgDriveRating = null;
    if (ratedDrives.length > 0) {
      const totalStars = ratedDrives.reduce((sum, drive) => {
        const entry = driveRatingMap.get(drive._id.toString());
        return sum + entry.sum / entry.count;
      }, 0);
      avgDriveRating = Math.round((totalStars / ratedDrives.length) * 10) / 10;
    }

    return {
      club: { _id: club._id, name: club.name, memberCount },
      totalDrives,
      completedDrives,
      cancelledDrives,
      completionRate,
      avgRSVPRate,
      avgAttendanceRate,
      avgDriveRating,
      mostPopularDrive,
      mostActiveMember
    };
  });

  res.json({ success: true, analytics });
});

/**
 * Notify all "going" members that check-in is open (leader can resend any time)
 * @route POST /api/drives/:driveId/request-checkin
 * @access Private (Club Leaders only)
 */
const requestCheckin = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const leaderId = req.user.id;

  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can request check-in for this drive', 403);
  }
  if (drive.isCompleted) {
    throw new AppError('This drive has already been marked completed — check-in is closed', 400);
  }

  drive.checkInRequestedAt = new Date();
  await drive.save();

  const goingRSVPs = await RSVP.find({ drive: driveId, status: 'going' }).select('user');
  goingRSVPs.forEach(rsvp => {
    notify(rsvp.user.toString(), {
      type: 'DRIVE_CHECKIN_REQUEST',
      message: `Check in for "${drive.name}" — let your club know you made it!`,
      data: { driveId, clubId: drive.club._id }
    });
  });

  res.json({
    success: true,
    message: `Check-in notification sent to ${goingRSVPs.length} member(s)`,
    checkInRequestedAt: drive.checkInRequestedAt
  });
});

/**
 * Get the requesting user's check-in status for a drive
 * @route GET /api/drives/:driveId/checkin-status
 * @access Private (members with a 'going' RSVP)
 */
const getCheckinStatus = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId).populate('club', 'name');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  const rsvp = await RSVP.findOne({ drive: driveId, user: userId, status: 'going' });
  if (!rsvp) {
    throw new AppError('Only members RSVPed as "going" can check in to this drive', 403);
  }

  res.json({
    success: true,
    driveName: drive.name,
    clubName: drive.club.name,
    isCompleted: drive.isCompleted,
    checkedIn: rsvp.checkedIn
  });
});

/**
 * Mark self as present or not-present for a drive
 * @route POST /api/drives/:driveId/checkin
 * @access Private (members with a 'going' RSVP)
 */
const submitCheckin = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { present } = req.body;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }
  if (drive.isCompleted) {
    throw new AppError('This drive has been marked completed — check-in is closed', 400);
  }

  const rsvp = await RSVP.findOne({ drive: driveId, user: userId, status: 'going' });
  if (!rsvp) {
    throw new AppError('Only members RSVPed as "going" can check in to this drive', 403);
  }

  rsvp.checkedIn = present ? 'present' : 'not-present';
  rsvp.checkedInAt = new Date();
  await rsvp.save();

  res.json({ success: true, checkedIn: rsvp.checkedIn });
});

/**
 * Submit (or update) a star rating + optional comment for a completed drive
 * @route POST /api/drives/:driveId/ratings
 * @access Private (members with a 'going' RSVP, only after the drive is completed)
 */
const submitRating = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { stars, comment } = req.body;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }
  if (!drive.isCompleted) {
    throw new AppError('Ratings can only be submitted after the drive is completed', 400);
  }

  const rsvp = await RSVP.findOne({ drive: driveId, user: userId, status: 'going' });
  if (!rsvp) {
    throw new AppError('Only members RSVPed as "going" can rate this drive', 403);
  }

  const rating = await DriveRating.findOneAndUpdate(
    { drive: driveId, user: userId },
    { stars, comment: comment || '' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, rating });
});

/**
 * Get all ratings for a drive, plus the average/count and the requester's own rating
 * @route GET /api/drives/:driveId/ratings
 * @access Private (any member of the drive's club)
 */
const getDriveRatings = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  const club = await Club.findById(drive.club).select('members');
  if (!club) {
    throw new AppError('Club not found', 404);
  }
  if (!club.members.some(m => m.toString() === userId)) {
    throw new AppError('You must be a member of this club to view ratings', 403);
  }

  const ratings = await DriveRating.find({ drive: driveId })
    .populate('user', 'username name')
    .sort({ createdAt: -1 })
    .lean();

  const count = ratings.length;
  const average = count > 0
    ? Math.round((ratings.reduce((sum, r) => sum + r.stars, 0) / count) * 10) / 10
    : null;

  const myRating = ratings.find(r => r.user._id.toString() === userId) || null;

  res.json({ success: true, average, count, ratings, myRating });
});

module.exports = {
  createDrive,
  getClubDrives,
  rsvpToDrive,
  cancelDrive,
  updateDrive,
  deleteDrive,
  getDriveAttendees,
  getDriveRSVPStatus,
  getLeaderDashboard,
  getMyRSVPs,
  getClubAnalytics,
  requestCheckin,
  getCheckinStatus,
  submitCheckin,
  submitRating,
  getDriveRatings
};
