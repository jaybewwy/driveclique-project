// The waitlist behind a full drive (UC-03): who moves up when a confirmed
// place frees, including when someone stops being a member of the drive's
// club (UC-51).

const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const { emailTemplates } = require('./emailService');
const { notifyAndEmail } = require('./memberNotifications');
const { formatDriveWhen, upcomingDriveFilter } = require('../utils/driveTime');

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
 * Delete a user's RSVPs to the drives of `clubIds` (of every club, when
 * omitted) that haven't started or been completed, and pass each confirmed
 * place they held to the next person on that drive's waitlist. RSVPs to
 * finished drives stay, so check-ins, ratings, the club's attendance
 * figures, and the user's own history are left alone.
 *
 * Called when someone leaves or is removed from a club, and when an
 * account is deleted.
 */
const withdrawFromUpcomingDrives = async (userId, clubIds) => {
  const rsvps = await RSVP.find({ user: userId }).select('drive status').lean();
  if (rsvps.length === 0) return;

  const drives = await Drive.find({
    _id: { $in: rsvps.map((r) => r.drive) },
    ...(clubIds && { club: { $in: clubIds } }),
    isCompleted: { $ne: true },
    ...upcomingDriveFilter(),
  })
    .select('name club date time startsAt timeZone isCancelled')
    .populate('club', 'name')
    .lean();
  if (drives.length === 0) return;

  await RSVP.deleteMany({ user: userId, drive: { $in: drives.map((d) => d._id) } });

  const heldPlaceOn = new Set(rsvps.filter((r) => r.status === 'going').map((r) => r.drive.toString()));
  for (const drive of drives) {
    if (!drive.isCancelled && heldPlaceOn.has(drive._id.toString())) {
      await promoteNextWaitlisted(drive, drive.club?.name);
    }
  }
};

module.exports = { promoteNextWaitlisted, withdrawFromUpcomingDrives };
