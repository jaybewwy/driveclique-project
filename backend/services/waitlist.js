// The waitlist behind a full drive (UC-03): who moves up when a confirmed
// place frees, including when someone stops being a member of the drive's
// club (UC-51).

const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const { emailTemplates } = require('./emailService');
const { notifyAndEmail } = require('./memberNotifications');
const { formatDriveWhen, upcomingDriveFilter } = require('../utils/driveTime');

/**
 * Called right after `rsvp` (a document) became "going", with `goingSince`
 * set: keep the place only if it is within `drive.maxAttendees`.
 *
 * Counting the free places first and then taking one is not enough. Members
 * answering at the same moment each saw a free place, and 8 of them took a
 * 2-place drive's places at once. So a place is taken first and checked
 * after: the RSVPs that became "going" earliest keep their places, and one
 * that came later than the drive has places for goes to the waitlist. Each
 * request checks only its own RSVP, so concurrent ones settle on the same
 * answer. Returns whether the place was kept.
 */
const keepPlaceIfRoom = async (rsvp, drive) => {
  if (!drive.maxAttendees) return true;

  const ahead = await RSVP.countDocuments({
    drive: rsvp.drive,
    status: 'going',
    _id: { $ne: rsvp._id },
    $or: [
      { goingSince: { $lt: rsvp.goingSince } },
      { goingSince: null },
      { goingSince: rsvp.goingSince, _id: { $lt: rsvp._id } },
    ],
  });
  if (ahead < drive.maxAttendees) return true;

  rsvp.status = 'waitlisted';
  rsvp.goingSince = undefined;
  await rsvp.save();
  return false;
};

// A confirmed spot just freed up: move the longest-waiting member to 'going'.
// `drive` needs `maxAttendees`, plus what the email names.
const promoteNextWaitlisted = async (drive, clubName) => {
  // Taken in one step, so two places freed at once go to two different people
  const nextInLine = await RSVP.findOneAndUpdate(
    { drive: drive._id, status: 'waitlisted' },
    { status: 'going', goingSince: new Date() },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );
  if (!nextInLine || !(await keepPlaceIfRoom(nextInLine, drive))) return;

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
    .select('name club date time startsAt timeZone isCancelled maxAttendees')
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

module.exports = { keepPlaceIfRoom, promoteNextWaitlisted, withdrawFromUpcomingDrives };
