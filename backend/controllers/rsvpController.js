// RSVPs: a member's going/maybe/not-going answer, the waitlist behind a full
// drive (UC-03), and the RSVP views for members, leaders, and the user's own
// history.

const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { emailTemplates } = require('../services/emailService');
const { notifyAndEmail } = require('../services/memberNotifications');
const { hasLeaderPrivileges, findClubAsMember } = require('../utils/clubPermissions');
const { countRsvpStatuses } = require('../utils/rsvpStats');
const { formatDriveWhen } = require('../utils/driveTime');

// A waitlisted RSVP's 1-based place in line. Derived from createdAt order at
// query time, so there's no stored position to keep in sync.
const waitlistPosition = async (driveId, createdAt) =>
  await RSVP.countDocuments({ drive: driveId, status: 'waitlisted', createdAt: { $lt: createdAt } }) + 1;

// A confirmed spot just freed up: move the longest-waiting member to 'going'
const promoteNextWaitlisted = async (drive, clubName) => {
  const nextInLine = await RSVP.findOne({ drive: drive._id, status: 'waitlisted' }).sort({ createdAt: 1 });
  if (!nextInLine) return;

  nextInLine.status = 'going';
  await nextInLine.save();

  await notifyAndEmail([nextInLine.user], {
    notification: {
      type: 'WAITLIST_PROMOTED',
      message: `A spot opened up — you're now confirmed for "${drive.name}"!`,
      data: { driveId: drive._id }
    },
    email: emailTemplates.waitlistPromoted({
      driveName: drive.name,
      clubName,
      driveDate: formatDriveWhen(drive)
    }),
  });
};

/**
 * RSVP to a Drive / Change RSVP Status
 * @route POST /api/drives/:driveId/rsvp
 * @access Private
 */
const rsvpToDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  // `status` is pre-validated at the route (going / maybe / not-going)
  const { status } = req.body;
  const userId = req.user.id;

  const drive = orNotFound(await Drive.findById(driveId), 'Drive not found');
  const club = await findClubAsMember(drive.club, userId, 'You must be a member of this club to RSVP', 'members name');

  // Fetch existing RSVP once — used by both the capacity check and the update path
  let rsvp = await RSVP.findOne({ drive: driveId, user: userId });
  const oldStatus = rsvp?.status ?? null;

  // ---------- PATH A: drive is full and user wants 'going' ----------
  if (status === 'going' && drive.maxAttendees && oldStatus !== 'going') {
    const goingCount = await RSVP.countDocuments({ drive: driveId, status: 'going' });
    if (goingCount >= drive.maxAttendees) {
      // Already on the waitlist — return current position without creating a duplicate
      if (oldStatus === 'waitlisted') {
        const position = await waitlistPosition(driveId, rsvp.createdAt);
        return res.json({ success: true, waitlisted: true, position, message: `You are #${position} on the waitlist`, rsvp });
      }

      // Enroll in the waitlist
      if (rsvp) {
        rsvp.status = 'waitlisted';
        await rsvp.save();
      } else {
        rsvp = await RSVP.create({ drive: driveId, user: userId, status: 'waitlisted' });
      }
      const position = await waitlistPosition(driveId, rsvp.createdAt);
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
      await promoteNextWaitlisted(drive, club.name);
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
 * Get RSVP Counts + Current User's RSVP Status for a Drive
 * @route GET /api/drives/:driveId/rsvp-status
 * @access Private (any authenticated club member)
 */
const getDriveRSVPStatus = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  const drive = orNotFound(await Drive.findById(driveId), 'Drive not found');
  await findClubAsMember(drive.club, userId, 'You must be a member of this club to view RSVP data');

  // createdAt is included for the waitlist position calculation below
  const rsvps = await RSVP.find({ drive: driveId })
    .select('user status createdAt checkedIn')
    .lean();

  const counts = countRsvpStatuses(rsvps);

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

  const userRSVP = rsvps.find(r => r.user.toString() === userId);

  // Same createdAt ordering as waitlistPosition(), computed from the RSVPs
  // already in hand instead of another query
  let waitlistPositionForUser = null;
  if (userRSVP?.status === 'waitlisted') {
    waitlistPositionForUser = rsvps.filter(r =>
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
    waitlistPosition: waitlistPositionForUser,
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

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');

  // Leader or co-leader can view attendees (UC-10)
  if (!hasLeaderPrivileges(drive.club, req.user.id)) {
    throw new AppError('Only the club leader or a co-leader can view the attendees of this drive', 403);
  }

  const rsvps = await RSVP.find({ drive: driveId })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });

  const stats = countRsvpStatuses(rsvps);

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

module.exports = {
  rsvpToDrive,
  getDriveRSVPStatus,
  getDriveAttendees,
  getMyRSVPs,
};
