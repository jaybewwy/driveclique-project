const cron = require('node-cron');
const logger = require('../utils/logger');
const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const { notify } = require('./notificationEmitter');
const { sendEmail, emailTemplates } = require('./emailService');
const { driveStartsInFilter, formatDriveWhen } = require('../utils/driveTime');

const sendReminders = async () => {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Keyed on the real start instant, so a reminder lands ~24h before the
  // drive starts rather than ~24h before midnight UTC of its day
  const drives = await Drive.find({
    ...driveStartsInFilter({ $gte: now, $lte: in24h }),
    isCancelled: false,
  }).populate('club', 'name _id').lean();

  if (!drives.length) return;

  for (const drive of drives) {
    const rsvps = await RSVP.find({
      drive: drive._id,
      status: { $in: ['going', 'maybe'] },
      reminderSent: false,
    }).lean();

    if (!rsvps.length) continue;

    const userIds = rsvps.map(r => r.user);
    const users = await User.find({
      _id: { $in: userIds },
      emailVerified: { $ne: false },
    }).select('_id email').lean();
    const emailMap = new Map(users.map(u => [u._id.toString(), u.email]));

    const tpl = emailTemplates.driveReminder({
      driveName: drive.name,
      clubName: drive.club?.name ?? 'your club',
      driveDatetime: formatDriveWhen(drive),
      location: drive.location,
    });

    const rsvpIds = [];
    for (const rsvp of rsvps) {
      const uid = rsvp.user.toString();
      notify(uid, {
        type: 'DRIVE_REMINDER',
        message: `Reminder: ${drive.name} is coming up tomorrow`,
        data: { driveId: drive._id, clubId: drive.club?._id },
      });
      const email = emailMap.get(uid);
      if (email) sendEmail({ to: email, ...tpl }); // fire-and-forget
      rsvpIds.push(rsvp._id);
    }

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
