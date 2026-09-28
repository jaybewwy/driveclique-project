// Leader-facing summaries across every club the user leads or co-leads
// (UC-10): the drive dashboard and per-club analytics (UC-20). Both batch
// their queries up front and aggregate in memory, so there are no per-club
// or per-drive round trips.

const Drive = require('../models/drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const DriveRating = require('../models/driveRating');
const { asyncHandler } = require('../middleware/errorHandler');
const { countRsvpStatuses } = require('../utils/rsvpStats');

const ledClubsFilter = (userId) => ({ $or: [{ leader: userId }, { coLeaders: userId }] });

// Group items into a Map keyed by the string form of item[key]
const groupBy = (items, key) => {
  const groups = new Map();
  items.forEach((item) => {
    const id = item[key].toString();
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  });
  return groups;
};

/**
 * Get Leader Dashboard Summary
 * @route GET /api/drives/dashboard
 * @access Private (Club Leaders only)
 */
const getLeaderDashboard = asyncHandler(async (req, res) => {
  const clubs = await Club.find(ledClubsFilter(req.user.id))
    .select('name description inviteCode members createdAt')
    .lean();

  if (clubs.length === 0) {
    return res.json({
      success: true,
      totalClubs: 0,
      dashboard: []
    });
  }

  const drives = await Drive.find({ club: { $in: clubs.map(club => club._id) } })
    .select('_id club name date time startsAt timeZone location isCancelled maxAttendees')
    .sort({ date: 1, startsAt: 1 })
    .lean();

  const rsvps = await RSVP.find({ drive: { $in: drives.map(drive => drive._id) } })
    .select('drive status')
    .lean();

  const rsvpsByDrive = groupBy(rsvps, 'drive');
  const drivesByClub = groupBy(drives, 'club');

  const dashboard = clubs.map(club => {
    const driveSummaries = (drivesByClub.get(club._id.toString()) || []).map(drive => {
      const driveRsvps = rsvpsByDrive.get(drive._id.toString()) || [];
      const stats = countRsvpStatuses(driveRsvps);

      return {
        _id: drive._id,
        name: drive.name,
        date: drive.date,
        time: drive.time,
        startsAt: drive.startsAt,
        timeZone: drive.timeZone,
        location: drive.location,
        isCancelled: drive.isCancelled || false,
        rsvpStats: {
          going: stats.going,
          maybe: stats.maybe,
          notGoing: stats.notGoing,
          totalRSVPs: driveRsvps.length,
          spotsLeft: Math.max(0, drive.maxAttendees - stats.going)
        }
      };
    });

    return {
      club: {
        _id: club._id,
        name: club.name,
        inviteCode: club.inviteCode,
        memberCount: club.members.length
      },
      drives: driveSummaries,
      totalDrives: driveSummaries.length
    };
  });

  res.json({
    success: true,
    totalClubs: dashboard.length,
    dashboard
  });
});

// The single club-analytics card, from pre-grouped lookups
const summarizeClub = (club, clubDrives, driveGoingMap, driveRatingMap, userMap) => {
  const memberCount = club.members.length;

  const totalDrives = clubDrives.length;
  const completedDrives = clubDrives.filter(d => d.isCompleted).length;
  const cancelledDrives = clubDrives.filter(d => d.isCancelled).length;
  const completionRate = totalDrives > 0
    ? Math.round((completedDrives / totalDrives) * 100)
    : 0;

  const goingCountOf = (drive) => driveGoingMap.get(drive._id.toString())?.count || 0;

  // avgRSVPRate: average of (goingCount / memberCount) per non-cancelled drive
  const activeDrives = clubDrives.filter(d => !d.isCancelled);
  let avgRSVPRate = 0;
  if (activeDrives.length > 0 && memberCount > 0) {
    const totalRate = activeDrives.reduce((sum, drive) => sum + goingCountOf(drive) / memberCount, 0);
    avgRSVPRate = Math.round((totalRate / activeDrives.length) * 100);
  }

  // mostPopularDrive: non-cancelled drive with highest going RSVP count
  let mostPopularDrive = null;
  let maxGoing = 0;
  activeDrives.forEach(drive => {
    const goingCount = goingCountOf(drive);
    if (goingCount > maxGoing) {
      maxGoing = goingCount;
      mostPopularDrive = { name: drive.name, date: drive.date, startsAt: drive.startsAt, timeZone: drive.timeZone, goingCount };
    }
  });

  // mostActiveMember: member with most going RSVPs across all this club's drives
  const memberRSVPCount = new Map();
  clubDrives.forEach(drive => {
    const goingUsers = driveGoingMap.get(drive._id.toString())?.userIds || [];
    goingUsers.forEach(uid => {
      memberRSVPCount.set(uid, (memberRSVPCount.get(uid) || 0) + 1);
    });
  });

  let mostActiveMember = null;
  let maxRSVPs = 0;
  memberRSVPCount.forEach((count, uid) => {
    if (count > maxRSVPs) {
      maxRSVPs = count;
      const u = userMap.get(uid);
      if (u) mostActiveMember = { username: u.username, name: u.name, rsvpCount: count };
    }
  });

  // avgAttendanceRate: average of (present / going) across drives where check-in was used
  const checkedInDrives = clubDrives.filter(d => d.checkInRequestedAt);
  let avgAttendanceRate = null;
  if (checkedInDrives.length > 0) {
    const totalRate = checkedInDrives.reduce((sum, drive) => {
      const entry = driveGoingMap.get(drive._id.toString());
      if (!entry || entry.count === 0) return sum;
      return sum + entry.present / entry.count;
    }, 0);
    avgAttendanceRate = Math.round((totalRate / checkedInDrives.length) * 100);
  }

  // avgDriveRating: average of each rated drive's own average star value,
  // over drives that have at least one rating (null if the club has never been rated)
  const ratedDrives = clubDrives.filter(d => driveRatingMap.has(d._id.toString()));
  let avgDriveRating = null;
  if (ratedDrives.length > 0) {
    const totalStars = ratedDrives.reduce((sum, drive) => {
      const entry = driveRatingMap.get(drive._id.toString());
      return sum + entry.sum / entry.count;
    }, 0);
    avgDriveRating = Math.round((totalStars / ratedDrives.length) * 10) / 10;
  }

  return {
    club: { _id: club._id, name: club.name, memberCount },
    totalDrives,
    completedDrives,
    cancelledDrives,
    completionRate,
    avgRSVPRate,
    avgAttendanceRate,
    avgDriveRating,
    mostPopularDrive,
    mostActiveMember
  };
};

/**
 * Get Club Analytics for Leader
 * @route GET /api/drives/analytics
 * @access Private (Club Leaders only)
 */
const getClubAnalytics = asyncHandler(async (req, res) => {
  // Batch query 1: all clubs led (or co-led, UC-10) by this user
  const clubs = await Club.find(ledClubsFilter(req.user.id))
    .select('name members')
    .lean();

  if (clubs.length === 0) {
    return res.json({ success: true, analytics: [] });
  }

  // Batch query 2: all drives for those clubs
  const drives = await Drive.find({ club: { $in: clubs.map(c => c._id) } })
    .select('_id club name date startsAt timeZone isCompleted isCancelled maxAttendees checkInRequestedAt')
    .lean();

  const driveIds = drives.map(d => d._id);

  // Batch queries 3 + 4: all going RSVPs and all ratings for those drives
  const [rsvps, ratings] = await Promise.all([
    RSVP.find({ drive: { $in: driveIds }, status: 'going' }).select('drive user checkedIn').lean(),
    DriveRating.find({ drive: { $in: driveIds } }).select('drive stars').lean(),
  ]);

  // Batch query 5: user info for most active member display
  const rsvpUserIds = [...new Set(rsvps.map(r => r.user.toString()))];
  const users = await User.find({ _id: { $in: rsvpUserIds } })
    .select('username name')
    .lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  // driveId -> { sum, count } of star ratings
  const driveRatingMap = new Map();
  ratings.forEach(rating => {
    const driveStr = rating.drive.toString();
    if (!driveRatingMap.has(driveStr)) {
      driveRatingMap.set(driveStr, { sum: 0, count: 0 });
    }
    const entry = driveRatingMap.get(driveStr);
    entry.sum += rating.stars;
    entry.count++;
  });

  // driveId -> { count, present, userIds[] } of going RSVPs
  const driveGoingMap = new Map();
  rsvps.forEach(rsvp => {
    const driveStr = rsvp.drive.toString();
    if (!driveGoingMap.has(driveStr)) {
      driveGoingMap.set(driveStr, { count: 0, present: 0, userIds: [] });
    }
    const entry = driveGoingMap.get(driveStr);
    entry.count++;
    if (rsvp.checkedIn === 'present') entry.present++;
    entry.userIds.push(rsvp.user.toString());
  });

  const drivesByClub = groupBy(drives, 'club');
  const analytics = clubs.map(club => summarizeClub(
    club,
    drivesByClub.get(club._id.toString()) || [],
    driveGoingMap,
    driveRatingMap,
    userMap
  ));

  res.json({ success: true, analytics });
});

module.exports = { getLeaderDashboard, getClubAnalytics };
