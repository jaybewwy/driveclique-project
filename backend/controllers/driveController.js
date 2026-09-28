const mongoose = require('mongoose');
const Drive = require('../models/drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const DriveRating = require('../models/driveRating');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { sendEmail, emailTemplates } = require('../services/emailService');
const { isClubLeader, isClubCoLeader, hasLeaderPrivileges } = require('../utils/clubPermissions');
const { buildVEvent, buildVCalendar } = require('../utils/ics');
// validateCoordinates guards the optional drive meeting-point pin (UC-23)
const { validateCoordinates, parseProximityQuery, haversineMiles, boundingBox, roundMiles } = require('../utils/geo');
const {
  resolveDriveSchedule,
  toCalendarDay,
  calendarDayToDate,
  addCalendarDays,
  addCalendarMonths,
  driveStartsAt,
  upcomingDriveFilter,
  formatDriveWhen,
  DEFAULT_TIME_ZONE,
} = require('../utils/driveTime');

// Post-drive photo gallery cap (UC-5) — leader/co-leader curated, kept small
// and bounded per the same storage-budget reasoning as User.cars[].photos.
const MAX_DRIVE_PHOTOS = 12;

// Recurring drive series cap (UC-11) — materialized upfront as real Drive
// documents, not open-ended/auto-renewing.
const MAX_RECURRENCE_COUNT = 12;

// Each occurrence's calendar day for a recurring series. Stepping calendar
// days (not adding 7 × 24h to an instant) keeps a 10 AM drive at 10 AM local
// on both sides of a DST change; each day's start instant is resolved in the
// drive's zone afterwards.
function buildRecurrenceDays(anchorDay, frequency, count) {
  const days = [anchorDay];
  for (let i = 1; i < count; i++) {
    const prev = days[i - 1];
    if (frequency === 'weekly') days.push(addCalendarDays(prev, 7));
    else if (frequency === 'biweekly') days.push(addCalendarDays(prev, 14));
    else days.push(addCalendarMonths(prev, 1)); // monthly
  }
  return days;
}

/**
 * Create a new Drive/Event
 * @route POST /api/drives
 * @access Private (Club Leaders only)
 */
const createDrive = asyncHandler(async (req, res) => {
  const { clubId, name, date, time, timeZone, location, description, difficulty, maxAttendees, image, coordinates, repeat } = req.body;
  validateCoordinates(coordinates);
  const schedule = resolveDriveSchedule({ date, time, timeZone });

  // Validate clubId is provided
  if (!clubId) {
    throw new AppError('clubId is required. You must create or select a club first.', 400);
  }

  // Verify club exists
  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Leader or co-leader can create drives (UC-10)
  if (!hasLeaderPrivileges(club, req.user.id)) {
    throw new AppError('Only the club leader or a co-leader can create drives for this club', 403);
  }

  // The start instant, not the calendar day, must be in the future — so a
  // drive later today is allowed and one earlier today isn't
  if (schedule.startsAt <= new Date()) {
    throw new AppError('Drive start time must be in the future', 400);
  }

  const baseFields = {
    club: clubId,
    name,
    time: schedule.time,
    timeZone: schedule.timeZone,
    location,
    coordinates: coordinates || undefined,
    description,
    difficulty: difficulty || 'Medium',
    maxAttendees: maxAttendees || 100,
    image: image || '',
    createdBy: req.user.id
  };

  // Recurring drive series (UC-11) — `repeat` is pre-validated at the route
  // (frequency enum, count 2-12) so no re-validation needed here.
  let newDrives;
  if (repeat && repeat.frequency) {
    const groupId = new mongoose.Types.ObjectId();
    const days = buildRecurrenceDays(toCalendarDay(schedule.date), repeat.frequency, repeat.count);
    const docs = days.map((day, i) => {
      const occurrence = resolveDriveSchedule({ date: calendarDayToDate(day), time: schedule.time, timeZone: schedule.timeZone });
      return {
        ...baseFields,
        date: occurrence.date,
        startsAt: occurrence.startsAt,
        recurrence: { groupId, frequency: repeat.frequency, index: i + 1, total: repeat.count },
      };
    });
    newDrives = await Drive.insertMany(docs);
  } else {
    const single = new Drive({ ...baseFields, date: schedule.date, startsAt: schedule.startsAt });
    await single.save();
    newDrives = [single];
  }

  const newDrive = newDrives[0];

  // Notify all club members about the new drive (SSE + email) — once per
  // series, not once per occurrence, to avoid notification/email spam.
  const driveClub = await Club.findById(clubId).select('members');
  if (driveClub) {
    // Only email members with a verified email (emailVerified !== false preserves existing accounts)
    const verifiedMembers = await User.find({
      _id: { $in: driveClub.members },
      emailVerified: { $ne: false }
    }).select('_id email');
    const emailMap = new Map(verifiedMembers.map(m => [m._id.toString(), m.email]));

    const seriesNote = newDrives.length > 1 ? ` (first of ${newDrives.length} dates)` : '';
    const tpl = emailTemplates.driveScheduled({ driveName: name, clubName: club.name, date: formatDriveWhen(newDrive), location });

    driveClub.members.forEach(memberId => {
      if (memberId.toString() !== req.user.id) {
        notify(memberId.toString(), { type: 'NEW_DRIVE', message: `New drive scheduled: "${name}"${seriesNote}`, data: { driveId: newDrive._id, clubId } });
        const email = emailMap.get(memberId.toString());
        if (email) sendEmail({ to: email, ...tpl });
      }
    });
  }

  res.status(201).json({
    success: true,
    message: newDrives.length > 1 ? `${newDrives.length} drives created successfully!` : 'Drive created successfully!',
    drive: newDrive,
    drives: newDrives
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
        .sort({ date: 1, startsAt: 1 })
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
    .sort({ date: 1, startsAt: 1 })
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
            driveDate: formatDriveWhen(drive)
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

  // Leader can cancel any drive; a co-leader can only cancel drives they
  // created themselves (UC-10) — full edit/delete stays leader-only.
  const canCancel = isClubLeader(drive.club, leaderId) ||
    (isClubCoLeader(drive.club, leaderId) && drive.createdBy.toString() === leaderId);
  if (!canCancel) {
    throw new AppError('Only the club leader, or a co-leader who created this drive, can cancel it', 403);
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
 * Cancel all remaining (future, not-already-cancelled) occurrences of a
 * recurring drive series (UC-11)
 * @route POST /api/drives/series/:groupId/cancel
 * @access Private (Club Leader only — bulk-cancelling a whole series is
 *         closer in blast radius to delete than a single cancel, which
 *         co-leaders may also do for drives they created)
 */
const cancelDriveSeries = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { cancellationReason } = req.body;
  const leaderId = req.user.id;

  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new AppError('Cancellation reason is required', 400);
  }

  const drives = await Drive.find({
    'recurrence.groupId': groupId,
    isCancelled: false,
    ...upcomingDriveFilter(),
  }).populate('club');

  if (drives.length === 0) {
    throw new AppError('No cancellable drives found in this series', 404);
  }

  if (!isClubLeader(drives[0].club, leaderId)) {
    throw new AppError('Only the club leader can cancel a recurring series', 403);
  }

  const reason = cancellationReason.trim();
  for (const drive of drives) {
    drive.isCancelled = true;
    drive.cancellationReason = reason;
    drive.cancelledAt = new Date();
    drive.cancelledBy = leaderId;
    await drive.save();

    const verifiedMembers = await User.find({
      _id: { $in: drive.club.members },
      emailVerified: { $ne: false }
    }).select('_id email');
    const emailMap = new Map(verifiedMembers.map(m => [m._id.toString(), m.email]));
    const tpl = emailTemplates.driveCancelled({ driveName: drive.name, clubName: drive.club.name, reason });
    drive.club.members.forEach(memberId => {
      if (memberId.toString() !== leaderId) {
        notify(memberId.toString(), {
          type: 'DRIVE_CANCELLED',
          message: `Drive "${drive.name}" has been cancelled`,
          data: { driveId: drive._id, clubId: drive.club._id }
        });
        const email = emailMap.get(memberId.toString());
        if (email) sendEmail({ to: email, ...tpl });
      }
    });
  }

  res.json({
    success: true,
    message: `Cancelled ${drives.length} remaining drive(s) in this series`,
    cancelledCount: drives.length
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
 * Export a single drive as a calendar event (UC-33)
 * @route GET /api/drives/:driveId/export.ics
 * @access Private (any club member)
 */
const exportDriveIcs = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId).populate('club', 'name members').lean();
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }
  if (!drive.club || !drive.club.members.some((m) => m.toString() === userId)) {
    throw new AppError('You must be a member of this club to export this drive', 403);
  }

  const ics = buildVCalendar([buildVEvent(drive, drive.club.name)]);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${drive.name.replace(/[^a-z0-9]/gi, '-')}.ics"`);
  res.send(ics);
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

  // Leader or co-leader can view attendees (UC-10)
  if (!hasLeaderPrivileges(drive.club, userId)) {
    throw new AppError('Only the club leader or a co-leader can view the attendees of this drive', 403);
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
      startsAt: drive.startsAt,
      timeZone: drive.timeZone,
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
  const { name, date, time, timeZone, location, description, difficulty, maxAttendees, isCompleted, image, coordinates } = req.body;
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
  // Any schedule change re-resolves the start instant from the merged
  // day/time/zone. A legacy drive being edited picks up the default zone
  // unless the client sends one (the web app always sends the leader's).
  if (date !== undefined || time !== undefined || timeZone !== undefined) {
    const schedule = resolveDriveSchedule({
      date: date ?? drive.date,
      time: time ?? drive.time,
      timeZone: timeZone ?? drive.timeZone ?? DEFAULT_TIME_ZONE,
    });
    Object.assign(drive, schedule);
  }
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

  // Find all clubs where user is the leader or a co-leader (UC-10)
  const clubs = await Club.find({ $or: [{ leader: userId }, { coLeaders: userId }] })
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
    .select('_id club name date time startsAt timeZone location isCancelled maxAttendees')
    .sort({ date: 1, startsAt: 1 })
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
        startsAt: drive.startsAt,
        timeZone: drive.timeZone,
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
      select: 'name date time startsAt timeZone location isCancelled isCompleted club',
      populate: { path: 'club', select: 'name _id' }
    })
    .sort({ createdAt: -1 })
    .lean();

  // Drop any RSVPs whose drive was hard-deleted
  const valid = rsvps.filter(r => r.drive);

  res.json({ success: true, rsvps: valid });
});

/**
 * Export the requesting user's upcoming schedule (UC-33)
 * @route GET /api/drives/my-rsvps/export.ics
 * @access Private
 */
const exportMyScheduleIcs = asyncHandler(async (req, res) => {
  const now = new Date();
  const rsvps = await RSVP.find({ user: req.user.id, status: { $in: ['going', 'maybe'] } })
    .populate({
      path: 'drive',
      select: 'name date time startsAt timeZone location description isCancelled club',
      populate: { path: 'club', select: 'name' }
    })
    .lean();

  const upcoming = rsvps.filter(
    (r) => r.drive && !r.drive.isCancelled && driveStartsAt(r.drive) >= now
  );

  const vevents = upcoming.map((r) => buildVEvent(r.drive, r.drive.club?.name || 'DriveClique'));
  const ics = buildVCalendar(vevents);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="driveclique-schedule.ics"');
  res.send(ics);
});

/**
 * Get Club Analytics for Leader
 * @route GET /api/drives/analytics
 * @access Private (Club Leaders only)
 */
const getClubAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Batch query 1: all clubs led (or co-led, UC-10) by this user
  const clubs = await Club.find({ $or: [{ leader: userId }, { coLeaders: userId }] })
    .select('name members')
    .lean();

  if (clubs.length === 0) {
    return res.json({ success: true, analytics: [] });
  }

  const clubIds = clubs.map(c => c._id);

  // Batch query 2: all drives for those clubs
  const drives = await Drive.find({ club: { $in: clubIds } })
    .select('_id club name date startsAt timeZone isCompleted isCancelled maxAttendees checkInRequestedAt')
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
        mostPopularDrive = { name: drive.name, date: drive.date, startsAt: drive.startsAt, timeZone: drive.timeZone, goingCount };
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
  // Leader or co-leader can send/resend check-in requests (UC-10)
  if (!hasLeaderPrivileges(drive.club, leaderId)) {
    throw new AppError('Only the club leader or a co-leader can request check-in for this drive', 403);
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

/**
 * Add photos to a completed drive's gallery (UC-5)
 * @route POST /api/drives/:driveId/photos
 * @access Private (Club Leaders only)
 */
const addDrivePhotos = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { photos } = req.body;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }
  // Leader or co-leader curate the gallery (UC-10-style shared moderation privilege)
  if (!hasLeaderPrivileges(drive.club, userId)) {
    throw new AppError('Only the club leader or a co-leader can add photos to this drive', 403);
  }
  if (!drive.isCompleted) {
    throw new AppError('Photos can only be added after the drive is marked completed', 400);
  }
  if (drive.photos.length + photos.length > MAX_DRIVE_PHOTOS) {
    throw new AppError(`This drive's gallery is capped at ${MAX_DRIVE_PHOTOS} photos (currently has ${drive.photos.length})`, 400);
  }

  drive.photos.push(...photos);
  await drive.save();

  const goingRSVPs = await RSVP.find({ drive: driveId, status: 'going' }).select('user');
  goingRSVPs.forEach(rsvp => {
    if (rsvp.user.toString() !== userId) {
      notify(rsvp.user.toString(), {
        type: 'DRIVE_PHOTOS_ADDED',
        message: `New photos were added to "${drive.name}"`,
        data: { driveId, clubId: drive.club._id }
      });
    }
  });

  res.json({ success: true, photos: drive.photos });
});

/**
 * Remove a single photo from a drive's gallery (UC-5)
 * @route DELETE /api/drives/:driveId/photos/:index
 * @access Private (Club Leaders only)
 */
const removeDrivePhoto = asyncHandler(async (req, res) => {
  const { driveId, index } = req.params;
  const userId = req.user.id;

  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }
  if (!hasLeaderPrivileges(drive.club, userId)) {
    throw new AppError('Only the club leader or a co-leader can remove photos from this drive', 403);
  }

  const i = parseInt(index, 10);
  if (!Number.isInteger(i) || i < 0 || i >= drive.photos.length) {
    throw new AppError('Invalid photo index', 400);
  }

  drive.photos.splice(i, 1);
  await drive.save();

  res.json({ success: true, photos: drive.photos });
});

/**
 * Get all drives across the user's clubs within a given month, for calendar display (UC-24)
 * @route GET /api/drives/calendar?year=&month=
 * @access Private
 */
const getCalendarDrives = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10); // 1-12

  const clubs = await Club.find({ members: userId }).select('name').lean();
  if (clubs.length === 0) {
    return res.json({ success: true, drives: [] });
  }

  const clubIds = clubs.map(c => c._id);
  const clubNameMap = new Map(clubs.map(c => [c._id.toString(), c.name]));

  const rangeStart = new Date(Date.UTC(year, month - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, month, 1)); // first day of next month, exclusive

  // Cancelled drives are excluded here to match this app's existing "upcoming/past
  // drives" list conventions elsewhere (ClubDetail.jsx filters them out of both).
  const drives = await Drive.find({
    club: { $in: clubIds },
    isCancelled: false,
    date: { $gte: rangeStart, $lt: rangeEnd }
  })
    .select('name date time startsAt timeZone location club isCompleted')
    .sort({ date: 1, startsAt: 1 })
    .lean();

  const driveIds = drives.map(d => d._id);
  const myRsvps = await RSVP.find({ drive: { $in: driveIds }, user: userId })
    .select('drive status')
    .lean();
  const rsvpMap = new Map(myRsvps.map(r => [r.drive.toString(), r.status]));

  const result = drives.map(d => ({
    _id: d._id,
    name: d.name,
    date: d.date,
    time: d.time,
    startsAt: d.startsAt,
    timeZone: d.timeZone,
    location: d.location,
    isCompleted: d.isCompleted,
    club: { _id: d.club, name: clubNameMap.get(d.club.toString()) || 'Unknown Club' },
    myRsvpStatus: rsvpMap.get(d._id.toString()) || null,
  }));

  res.json({ success: true, drives: result });
});

/**
 * Upcoming drives near a point (UC-46)
 * @route GET /api/drives/nearby?lat=&lng=&radius=&limit=
 * @access Private
 * @note  Only drives with a meeting-point pin (UC-23), from public clubs or
 *        clubs the user belongs to, minus clubs the user has blocked — a
 *        private club's drives never surface to non-members. Soonest first.
 */
const getNearbyDrives = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const proximity = parseProximityQuery(req.query);
  if (!proximity) {
    throw new AppError('lat and lng are required', 400);
  }
  const { center, radiusMiles } = proximity;
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  // Drive.coordinates is a plain { lat, lng } subdocument (no geo index), so
  // prefilter on the circle's bounding box, then check exact distance below.
  const box = boundingBox(center, radiusMiles);
  const filter = {
    isCancelled: { $ne: true },
    isCompleted: { $ne: true },
    ...upcomingDriveFilter(),
    'coordinates.lat': { $gte: box.minLat, $lte: box.maxLat },
  };
  if (box.minLng !== null) {
    filter['coordinates.lng'] = { $gte: box.minLng, $lte: box.maxLng };
  }

  const candidates = await Drive.find(filter)
    .select('name date time startsAt timeZone location difficulty coordinates club')
    .lean();

  // Sorted here rather than in Mongo: unmigrated drives have no startsAt,
  // and a Mongo sort would put those nulls first instead of by their date
  const inRadius = candidates
    .map((d) => ({ drive: d, miles: haversineMiles(center, d.coordinates) }))
    .filter(({ miles }) => miles <= radiusMiles)
    .sort((a, b) => driveStartsAt(a.drive) - driveStartsAt(b.drive));
  if (inRadius.length === 0) {
    return res.json({ success: true, drives: [] });
  }

  const requestingUser = await User.findById(userId).select('blockedClubs').lean();
  const candidateClubIds = [...new Set(inRadius.map(({ drive }) => drive.club.toString()))];
  const visibleClubs = await Club.find({
    _id: { $in: candidateClubIds, $nin: requestingUser?.blockedClubs || [] },
    $or: [{ isPrivate: false }, { members: userId }],
  })
    .select('name')
    .lean();
  const clubNameMap = new Map(visibleClubs.map((c) => [c._id.toString(), c.name]));

  const drives = inRadius
    .filter(({ drive }) => clubNameMap.has(drive.club.toString()))
    .slice(0, limitNum)
    .map(({ drive, miles }) => ({
      _id: drive._id,
      name: drive.name,
      date: drive.date,
      time: drive.time,
      startsAt: drive.startsAt,
      timeZone: drive.timeZone,
      location: drive.location,
      difficulty: drive.difficulty,
      distanceMiles: roundMiles(miles),
      club: { _id: drive.club, name: clubNameMap.get(drive.club.toString()) },
    }));

  res.json({ success: true, drives });
});

module.exports = {
  createDrive,
  getClubDrives,
  rsvpToDrive,
  cancelDrive,
  cancelDriveSeries,
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
  getDriveRatings,
  getCalendarDrives,
  exportDriveIcs,
  exportMyScheduleIcs,
  addDrivePhotos,
  removeDrivePhoto,
  getNearbyDrives
};
