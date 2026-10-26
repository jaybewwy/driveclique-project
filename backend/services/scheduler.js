const os = require('os');
const crypto = require('crypto');
const cron = require('node-cron');
const logger = require('../utils/logger');
const JobLease = require('../models/jobLease');
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
  })
    .select('club name date time startsAt timeZone location')
    .populate('club', 'name members')
    .lean();

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

// This process, as a lease holder
const HOLDER = `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString('hex')}`;

/**
 * Take the lease on `job` for `ms`, or return false while another process
 * holds it. A deploy runs the old and new API side by side, each with this
 * cron; without the lease both would send the hour's reminders. The lease is
 * kept, not released, so one run per hour is all there is.
 */
const acquireLease = async (job, ms) => {
  const now = new Date();
  try {
    await JobLease.findOneAndUpdate(
      { _id: job, until: { $lte: now } },
      { holder: HOLDER, until: new Date(now.getTime() + ms) },
      { upsert: true }
    );
    return true;
  } catch (err) {
    // Another holder's unexpired lease: the upsert collides with its _id
    if (err.code === 11000) return false;
    throw err;
  }
};

// Shorter than the hour between runs, longer than any run
const REMINDER_LEASE_MS = 50 * 60 * 1000;

const runReminders = async () => {
  if (!(await acquireLease('drive_reminders', REMINDER_LEASE_MS))) {
    logger.info('scheduler_skipped', { job: 'drive_reminders', reason: 'another process holds the lease' });
    return;
  }
  logger.info('scheduler_run', { job: 'drive_reminders' });
  await sendReminders();
};

const startScheduler = () => {
  // Runs at the top of every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await runReminders();
    } catch (err) {
      logger.error('scheduler_error', { job: 'drive_reminders', err: err.message });
    }
  });
  logger.info('scheduler_started');
};

module.exports = { startScheduler, sendReminders, runReminders, acquireLease };
