// Drive lifecycle: create (one-off or a recurring series), list, edit,
// cancel, delete, plus the nearby-drives search. RSVPs, check-in/ratings,
// photos, calendar/.ics, and leader insights live in their own controllers.

const mongoose = require('mongoose');
const Drive = require('../models/drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { emailTemplates } = require('../services/emailService');
const { getVerifiedEmails, notifyAndEmail } = require('../services/memberNotifications');
const { isClubLeader, isClubCoLeader, hasLeaderPrivileges } = require('../utils/clubPermissions');
const { clampLimit, parsePageParams, paginationMeta } = require('../utils/pagination');
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

// Each occurrence's calendar day for a recurring series (UC-11). Stepping
// calendar days (not adding 7 × 24h to an instant) keeps a 10 AM drive at
// 10 AM local on both sides of a DST change; each day's start instant is
// resolved in the drive's zone afterwards.
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

const markCancelled = (drive, reason, userId) => {
  drive.isCancelled = true;
  drive.cancellationReason = reason;
  drive.cancelledAt = new Date();
  drive.cancelledBy = userId;
};

// SSE/push + email to every member of the drive's (populated) club except
// the person who cancelled it
const notifyDriveCancelled = (drive, reason, cancelledBy, verifiedEmails) =>
  notifyAndEmail(drive.club.members, {
    excludeUserId: cancelledBy,
    verifiedEmails,
    notification: {
      type: 'DRIVE_CANCELLED',
      message: `Drive "${drive.name}" has been cancelled`,
      data: { driveId: drive._id, clubId: drive.club._id },
    },
    email: emailTemplates.driveCancelled({ driveName: drive.name, clubName: drive.club.name, reason }),
  });

/**
 * Create a new Drive/Event
 * @route POST /api/drives
 * @access Private (Club Leaders only)
 */
const createDrive = asyncHandler(async (req, res) => {
  const { clubId, name, date, time, timeZone, location, description, difficulty, maxAttendees, image, coordinates, repeat } = req.body;
  validateCoordinates(coordinates);
  const schedule = resolveDriveSchedule({ date, time, timeZone });

  if (!clubId) {
    throw new AppError('clubId is required. You must create or select a club first.', 400);
  }

  const club = orNotFound(await Club.findById(clubId), 'Club not found');

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
  // (frequency enum, count 2..MAX_RECURRENCE_COUNT) so no re-validation here.
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
  const seriesNote = newDrives.length > 1 ? ` (first of ${newDrives.length} dates)` : '';
  await notifyAndEmail(club.members, {
    excludeUserId: req.user.id,
    notification: { type: 'NEW_DRIVE', message: `New drive scheduled: "${name}"${seriesNote}`, data: { driveId: newDrive._id, clubId } },
    email: emailTemplates.driveScheduled({ driveName: name, clubName: club.name, date: formatDriveWhen(newDrive), location }),
  });

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
  const clubDrives = () => Drive.find({ club: clubId })
    .sort({ date: 1, startsAt: 1 })
    .populate('createdBy', 'username name');

  // If page/limit are provided, paginate; otherwise return all (backwards-compatible)
  if (req.query.page !== undefined || req.query.limit !== undefined) {
    const paging = parsePageParams(req.query);
    const [drives, total] = await Promise.all([
      clubDrives().skip(paging.skip).limit(paging.limit),
      Drive.countDocuments({ club: clubId }),
    ]);
    return res.json({ success: true, drives, pagination: paginationMeta(paging, total, drives.length) });
  }

  res.json({ success: true, drives: await clubDrives() });
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
  const limitNum = clampLimit(req.query.limit);

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

/**
 * Update a Drive (Edit details or mark as complete)
 * @route PUT /api/drives/:driveId
 * @access Private (Club Leaders only)
 */
const updateDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { name, date, time, timeZone, location, description, difficulty, maxAttendees, isCompleted, image, coordinates } = req.body;
  validateCoordinates(coordinates);

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');

  if (!isClubLeader(drive.club, req.user.id)) {
    throw new AppError('Only the club leader can update this drive', 403);
  }

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

  if (isCompleted !== undefined) {
    drive.isCompleted = Boolean(isCompleted);
    drive.completedAt = isCompleted ? new Date() : undefined;
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

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');

  if (!isClubLeader(drive.club, req.user.id)) {
    throw new AppError('Only the club leader can delete this drive', 403);
  }

  await Drive.findByIdAndDelete(driveId);
  await RSVP.deleteMany({ drive: driveId });

  res.json({
    success: true,
    message: 'Drive deleted successfully'
  });
});

/**
 * Cancel a Drive
 * @route POST /api/drives/:driveId/cancel
 * @access Private (Club Leaders only)
 */
const cancelDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { cancellationReason } = req.body;
  const userId = req.user.id;

  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new AppError('Cancellation reason is required', 400);
  }

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');

  // Leader can cancel any drive; a co-leader can only cancel drives they
  // created themselves (UC-10) — full edit/delete stays leader-only.
  const canCancel = isClubLeader(drive.club, userId) ||
    (isClubCoLeader(drive.club, userId) && drive.createdBy.toString() === userId);
  if (!canCancel) {
    throw new AppError('Only the club leader, or a co-leader who created this drive, can cancel it', 403);
  }

  const reason = cancellationReason.trim();
  markCancelled(drive, reason, userId);
  await drive.save();

  await notifyDriveCancelled(drive, reason, userId);

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
  const userId = req.user.id;

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

  if (!isClubLeader(drives[0].club, userId)) {
    throw new AppError('Only the club leader can cancel a recurring series', 403);
  }

  // Every occurrence belongs to the same club, so look its members' email
  // addresses up once rather than once per drive
  const reason = cancellationReason.trim();
  const verifiedEmails = await getVerifiedEmails(drives[0].club.members);
  for (const drive of drives) {
    markCancelled(drive, reason, userId);
    await drive.save();
    await notifyDriveCancelled(drive, reason, userId, verifiedEmails);
  }

  res.json({
    success: true,
    message: `Cancelled ${drives.length} remaining drive(s) in this series`,
    cancelledCount: drives.length
  });
});

module.exports = {
  createDrive,
  getClubDrives,
  getNearbyDrives,
  updateDrive,
  deleteDrive,
  cancelDrive,
  cancelDriveSeries,
};
