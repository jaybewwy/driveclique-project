// Post-drive photo gallery (UC-5): leader/co-leader curated, only after the
// drive is marked completed, capped at MAX_DRIVE_PHOTOS per drive.

const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { hasLeaderPrivileges } = require('../utils/clubPermissions');

const { MAX_DRIVE_PHOTOS } = Drive;

/**
 * Add photos to a completed drive's gallery (UC-5)
 * @route POST /api/drives/:driveId/photos
 * @access Private (Club Leaders only)
 */
const addDrivePhotos = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { photos } = req.body;
  const userId = req.user.id;

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');
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

  const drive = orNotFound(await Drive.findById(driveId).populate('club'), 'Drive not found');
  if (!hasLeaderPrivileges(drive.club, req.user.id)) {
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

module.exports = { addDrivePhotos, removeDrivePhoto };
