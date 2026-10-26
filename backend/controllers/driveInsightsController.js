// Leader-facing summaries across every club the user leads or co-leads
// (UC-10): the drive dashboard and per-club analytics (UC-20). Both batch
// their queries up front, so there are no per-club or per-drive round trips,
// and MongoDB does the counting: a club's whole history reaches the API as a
// few rows per drive, not as every RSVP and rating.

const Drive = require('../models/drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const User = require('../models/user');
const DriveRating = require('../models/driveRating');
const { asyncHandler } = require('../middleware/errorHandler');
const { countRsvpsByDrive } = require('../utils/rsvpStats');
const { isClubLeader } = require('../utils/clubPermissions');

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
    .select('name description inviteCode leader members createdAt')
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

  const countsByDrive = await countRsvpsByDrive(drives.map(drive => drive._id));
  const drivesByClub = groupBy(drives, 'club');

  const dashboard = clubs.map(club => {
    const driveSummaries = (drivesByClub.get(club._id.toString()) || []).map(drive => {
      const stats = countsByDrive.get(drive._id.toString());

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
          totalRSVPs: stats.going + stats.maybe + stats.notGoing + stats.waitlisted,
          spotsLeft: Math.max(0, drive.maxAttendees - stats.going)
        }
      };
    });

    return {
      club: {
        _id: club._id,
        name: club.name,
        // Co-leaders see the clubs they help run here too, but the invite
        // code is the leader's alone, as in every club read (utils/clubView.js)
        ...(isClubLeader(club, req.user.id) && { inviteCode: club.inviteCode }),
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

// The single club-analytics card, from MongoDB's counts
const summarizeClub = (club, clubDrives, driveGoingMap, driveRatingMap, mostActiveMember) => {
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

  // Batch queries 3 + 4, counted by MongoDB: per drive, its going RSVPs,
  // check-ins, and who is going (ids only); and its star ratings
  const [going, ratings] = await Promise.all([
    RSVP.aggregate([
      { $match: { drive: { $in: driveIds }, status: 'going' } },
      { $group: {
        _id: '$drive',
        count: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$checkedIn', 'present'] }, 1, 0] } },
        users: { $push: '$user' },
      } },
    ]),
    DriveRating.aggregate([
      { $match: { drive: { $in: driveIds } } },
      { $group: { _id: '$drive', sum: { $sum: '$stars' }, count: { $sum: 1 } } },
    ]),
  ]);
  const driveGoingMap = new Map(going.map((g) => [g._id.toString(), g]));
  const driveRatingMap = new Map(ratings.map((r) => [r._id.toString(), r]));
  const drivesByClub = groupBy(drives, 'club');

  // Each club's member with the most going RSVPs, ties to the lower user id
  const topGoerByClub = new Map(clubs.map((club) => {
    const perUser = new Map();
    (drivesByClub.get(club._id.toString()) || []).forEach((drive) => {
      (driveGoingMap.get(drive._id.toString())?.users || []).forEach((id) => {
        const uid = id.toString();
        perUser.set(uid, (perUser.get(uid) || 0) + 1);
      });
    });
    let top = null;
    perUser.forEach((count, uid) => {
      if (!top || count > top.count || (count === top.count && uid < top.uid)) top = { uid, count };
    });
    return [club._id.toString(), top];
  }));

  // Batch query 5: names for the most active members
  const topIds = [...topGoerByClub.values()].filter(Boolean).map((t) => t.uid);
  const users = await User.find({ _id: { $in: topIds } }).select('username name').lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));
  const mostActiveByClub = new Map([...topGoerByClub].map(([clubId, top]) => {
    const u = top && userMap.get(top.uid);
    return [clubId, u ? { username: u.username, name: u.name, rsvpCount: top.count } : null];
  }));
  const analytics = clubs.map(club => summarizeClub(
    club,
    drivesByClub.get(club._id.toString()) || [],
    driveGoingMap,
    driveRatingMap,
    mostActiveByClub.get(club._id.toString()) ?? null
  ));

  res.json({ success: true, analytics });
});

module.exports = { getLeaderDashboard, getClubAnalytics };
