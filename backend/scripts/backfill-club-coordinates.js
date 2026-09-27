/**
 * One-off backfill for UC-46 proximity search: geocode the free-text
 * `location` of clubs created before clubs stored coordinates, so they can
 * show up in radius searches.
 *
 * Dry run by default — prints what each location would resolve to and
 * writes nothing. Free-typed locations can be ambiguous ("Springfield"), so
 * check the resolved place names before writing:
 *
 *   node scripts/backfill-club-coordinates.js           # dry run
 *   node scripts/backfill-club-coordinates.js --apply   # write geo points
 *
 * Uses the same public Nominatim API as the frontend's LocationSearch, at
 * its usage-policy limit of one request per second with an identifying
 * User-Agent. Not part of any automated suite.
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Club = require('../models/club');
const { toGeoPoint } = require('../utils/geo');

const APPLY = process.argv.includes('--apply');
const NOMINATIM_DELAY_MS = 1100;
const USER_AGENT = 'DriveClique club-coordinates backfill (one-off maintenance script)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(location) {
  const url = 'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) {
    throw Object.assign(new Error(`Nominatim responded ${res.status}`), { status: res.status });
  }
  const [top] = await res.json();
  if (!top) return null;
  return { lat: Number(top.lat), lng: Number(top.lon), displayName: top.display_name };
}

async function backfill() {
  // autoIndex/autoCreate off so a dry run stays strictly read-only — no
  // index builds or collection creation against whatever MONGO_URI points at
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);

  const clubs = await Club.find({
    location: { $nin: ['', null] },
    'geo.coordinates': { $exists: false },
  })
    .select('name location')
    .lean();
  console.log(`${clubs.length} club(s) have a location but no coordinates.\n`);

  const summary = { resolved: 0, unresolved: 0, failed: 0 };
  // Many clubs share a location string; geocode each distinct one only once,
  // caching failures too so an error never turns into an unthrottled retry
  const cache = new Map();
  let requests = 0;
  for (const club of clubs) {
    const label = `"${club.name}" — "${club.location}"`;
    if (!cache.has(club.location)) {
      if (requests++ > 0) await sleep(NOMINATIM_DELAY_MS);
      try {
        cache.set(club.location, { hit: await geocode(club.location) });
      } catch (error) {
        cache.set(club.location, { error });
      }
    }
    const { hit, error } = cache.get(club.location);
    if (error?.status === 429) {
      console.log(`  ! ${label}: Nominatim is rate-limiting this IP. Stopping; try again later.`);
      summary.failed++;
      break;
    }
    try {
      if (error) throw error;
      if (!hit) {
        summary.unresolved++;
        console.log(`  ✗ ${label}: no match, left as-is`);
        continue;
      }
      summary.resolved++;
      console.log(`  ✓ ${label}\n      → ${hit.displayName} (${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)})`);
      if (APPLY) {
        await Club.updateOne({ _id: club._id }, { $set: { geo: toGeoPoint(hit) } });
      }
    } catch (error) {
      summary.failed++;
      console.log(`  ! ${label}: ${error.message}`);
    }
  }

  console.log(`\nResolved ${summary.resolved}, no match ${summary.unresolved}, errors ${summary.failed}.`);
  if (!APPLY && summary.resolved > 0) {
    console.log('Dry run only — re-run with --apply to write these points.');
  }
}

backfill()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
