// What happens at and after a drive: check-in (UC-08) and star ratings
// (UC-25). Both are limited to members who RSVPed "going".

const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const DriveRating = require('../models/driveRating');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { hasLeaderPrivileges, findClubAsMember } = require('../utils/clubPermissions');

const findGoingRsvp = async (driveId, userId, forbiddenMessage) => {
  const rsvp = await RSVP.findOne({ drive: driveId, user: userId, status: 'going' });
  if (!rsvp) throw new AppError(forbiddenMessage, 403);
  return rsvp;
};

/**
 * Notify all "going" members that check-in is open (leader can resend any time)
 * @route POST /api/drives/:driveId/request-checkin
 * @access Private (Club Leaders only)
 */
const requestCheckin = asyncHandler(async (req, res) => {
  const { driveId } = req.params;

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');
  // Leader or co-leader can send/resend check-in requests (UC-10)
  if (!hasLeaderPrivileges(drive.club, req.user.id)) {
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

  const drive = orNotFound(await Drive.findById(driveId).populate('club', 'name'), 'Drive not found');
  const rsvp = await findGoingRsvp(driveId, req.user.id, 'Only members RSVPed as "going" can check in to this drive');

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

  const drive = orNotFound(await Drive.findById(driveId), 'Drive not found');
  if (drive.isCompleted) {
    throw new AppError('This drive has been marked completed — check-in is closed', 400);
  }

  const rsvp = await findGoingRsvp(driveId, req.user.id, 'Only members RSVPed as "going" can check in to this drive');

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

  const drive = orNotFound(await Drive.findById(driveId), 'Drive not found');
  if (!drive.isCompleted) {
    throw new AppError('Ratings can only be submitted after the drive is completed', 400);
  }

  await findGoingRsvp(driveId, userId, 'Only members RSVPed as "going" can rate this drive');

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

  const drive = orNotFound(await Drive.findById(driveId), 'Drive not found');
  await findClubAsMember(drive.club, userId, 'You must be a member of this club to view ratings');

  // A rating whose author no longer exists populates to user: null. Account
  // deletion now removes a user's ratings, but older ones may remain.
  const ratings = (await DriveRating.find({ drive: driveId })
    .populate('user', 'username name')
    .sort({ createdAt: -1 })
    .lean())
    .filter((r) => r.user);

  const count = ratings.length;
  const average = count > 0
    ? Math.round((ratings.reduce((sum, r) => sum + r.stars, 0) / count) * 10) / 10
    : null;

  const myRating = ratings.find(r => r.user._id.toString() === userId) || null;

  res.json({ success: true, average, count, ratings, myRating });
});

module.exports = {
  requestCheckin,
  getCheckinStatus,
  submitCheckin,
  submitRating,
  getDriveRatings,
};
