const cron = require('node-cron');
const logger = require('../utils/logger');
const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const { notify } = require('./notificationEmitter');
const { sendEmail, emailTemplates } = require('./emailService');

const sendReminders = async () => {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const drives = await Drive.find({
    date: { $gte: now, $lte: in24h },
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

    const dateStr = new Date(drive.date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const tpl = emailTemplates.driveReminder({
      driveName: drive.name,
      clubName: drive.club?.name ?? 'your club',
      driveDatetime: dateStr,
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
