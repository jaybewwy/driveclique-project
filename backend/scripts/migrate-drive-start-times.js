/**
 * One-time migration: give drives created before time zones were stored a
 * real start instant (`startsAt`) and a `timeZone`, so they display and
 * remind at the right time. See utils/driveTime.js for the model.
 *
 * Each legacy drive's calendar day is the UTC date of its `date` (the rule
 * the Calendar page and .ics export already used) and its wall-clock start
 * is its `time` text, read in the given zone. `date` is normalized to UTC
 * midnight and `time` to "H:MM AM/PM" along the way.
 *
 * Dry run by default — prints what would change and writes nothing:
 *
 *   node scripts/migrate-drive-start-times.js
 *   node scripts/migrate-drive-start-times.js --apply
 *   node scripts/migrate-drive-start-times.js --time-zone America/Phoenix --apply
 *
 * The zone defaults to DEFAULT_TIME_ZONE (America/Los_Angeles). Only drives
 * without `startsAt` are touched, so re-running is safe. Drives whose time
 * text can't be parsed are listed and left alone; they keep working through
 * the legacy fallbacks until a leader edits them.
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const Drive = require('../models/drive');
const { resolveDriveSchedule, isValidTimeZone, DEFAULT_TIME_ZONE } = require('../utils/driveTime');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const zoneFlag = args.findIndex((a) => a === '--time-zone' || a.startsWith('--time-zone='));
const TIME_ZONE = zoneFlag === -1
  ? DEFAULT_TIME_ZONE
  : args[zoneFlag].includes('=') ? args[zoneFlag].split('=')[1] : args[zoneFlag + 1];
const SAMPLE_SIZE = 10;
const BATCH_SIZE = 500;

async function migrate() {
  if (!isValidTimeZone(TIME_ZONE)) {
    throw new Error(`Unknown time zone "${TIME_ZONE}"`);
  }
  // autoIndex/autoCreate off so a dry run stays strictly read-only
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'} · zone: ${TIME_ZONE}\n`);

  const legacy = await Drive.find({ startsAt: null }).select('name date time').lean();
  console.log(`${legacy.length} drive(s) have no start instant yet.\n`);

  const updates = [];
  const skipped = [];
  for (const drive of legacy) {
    try {
      const schedule = resolveDriveSchedule({ date: drive.date, time: drive.time, timeZone: TIME_ZONE });
      updates.push({ drive, schedule });
    } catch (error) {
      skipped.push({ drive, reason: error.message });
    }
  }

  for (const { drive, schedule } of updates.slice(0, SAMPLE_SIZE)) {
    const local = schedule.startsAt.toLocaleString('en-US', {
      timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short',
    });
    console.log(`  ✓ "${drive.name}": ${drive.time} on ${drive.date.toISOString().slice(0, 10)} → ${local} (${schedule.startsAt.toISOString()})`);
  }
  if (updates.length > SAMPLE_SIZE) console.log(`  … and ${updates.length - SAMPLE_SIZE} more`);
  for (const { drive, reason } of skipped) {
    console.log(`  ✗ "${drive.name}" (${drive._id}): ${reason} — time is ${JSON.stringify(drive.time)}; left as-is`);
  }

  if (APPLY && updates.length > 0) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      await Drive.bulkWrite(updates.slice(i, i + BATCH_SIZE).map(({ drive, schedule }) => ({
        updateOne: {
          // startsAt: null again here so a concurrent edit that already set it wins
          filter: { _id: drive._id, startsAt: null },
          update: { $set: schedule },
        },
      })));
    }
  }

  console.log(`\n${updates.length} convertible, ${skipped.length} skipped.`);
  if (!APPLY && updates.length > 0) console.log('Dry run only — re-run with --apply to write these.');
}

migrate()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
