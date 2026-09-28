const Club = require('../models/club');
const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const DriveRating = require('../models/driveRating');

/**
 * Permanently delete clubs along with everything that hangs off them: their
 * drives and those drives' RSVPs and ratings. Shared by club deletion and
 * account deletion (for clubs the departing user leads alone).
 */
const deleteClubsCascade = async (clubIds) => {
  if (clubIds.length === 0) return;

  const drives = await Drive.find({ club: { $in: clubIds } }).select('_id').lean();
  if (drives.length > 0) {
    const driveIds = drives.map((d) => d._id);
    await RSVP.deleteMany({ drive: { $in: driveIds } });
    await DriveRating.deleteMany({ drive: { $in: driveIds } });
  }
  await Drive.deleteMany({ club: { $in: clubIds } });
  await Club.deleteMany({ _id: { $in: clubIds } });
};

module.exports = { deleteClubsCascade };
