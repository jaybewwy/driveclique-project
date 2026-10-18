const cron = require('node-cron');
const logger = require('../utils/logger');
const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const { emailTemplates } = require('./emailService');
const { notifyAndEmail } = require('./memberNotifications');
const { driveStartsInFilter, formatDriveWhen } = require('../utils/driveTime');
const { isClubMember } = require('../utils/clubPermissions');

const sendReminders = async () => {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Keyed on the real start instant, so a reminder lands ~24h before the
  // drive starts rather than ~24h before midnight UTC of its day
  const drives = await Drive.find({
    ...driveStartsInFilter({ $gte: now, $lte: in24h }),
    isCancelled: false,
  }).populate('club', 'name members').lean();

  if (!drives.length) return;

  for (const drive of drives) {
    // Only current members are reminded (UC-51). Leaving or removal deletes
    // the RSVPs too; this covers any left over from before it did.
    const rsvps = (await RSVP.find({
      drive: drive._id,
      status: { $in: ['going', 'maybe'] },
      reminderSent: false,
    }).lean()).filter((r) => isClubMember(drive.club, r.user));

    if (!rsvps.length) continue;

    await notifyAndEmail(rsvps.map(r => r.user), {
      notification: {
        type: 'DRIVE_REMINDER',
        message: `Reminder: ${drive.name} is coming up tomorrow`,
        data: { driveId: drive._id, clubId: drive.club?._id },
      },
      email: emailTemplates.driveReminder({
        driveName: drive.name,
        clubName: drive.club?.name ?? 'your club',
        driveDatetime: formatDriveWhen(drive),
        location: drive.location,
      }),
    });

    const rsvpIds = rsvps.map(r => r._id);
    await RSVP.updateMany({ _id: { $in: rsvpIds } }, { reminderSent: true });
    logger.info('drive_reminders_sent', { driveId: drive._id, count: rsvpIds.length });
  }
};

const startScheduler = () => {
  // Runs at the top of every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('scheduler_run', { job: 'drive_reminders' });
    try {
      await sendReminders();
    } catch (err) {
      logger.error('scheduler_error', { job: 'drive_reminders', err: err.message });
    }
  });
  logger.info('scheduler_started');
};

module.exports = { startScheduler, sendReminders };
