// Calendar views of drives: the month grid across the user's clubs (UC-24)
// and iCalendar (.ics) exports of one drive or the user's schedule (UC-33).

const Drive = require('../models/drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { isClubMember } = require('../utils/clubPermissions');
const { buildVEvent, buildVCalendar } = require('../utils/ics');
const { driveStartsAt } = require('../utils/driveTime');

const sendIcs = (res, filename, ics) => {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(ics);
};

/**
 * Get all drives across the user's clubs within a given month, for calendar display (UC-24)
 * @route GET /api/drives/calendar?year=&month=
 * @access Private
 */
const getCalendarDrives = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10); // 1-12

  const clubs = await Club.find({ members: userId }).select('name').lean();
  if (clubs.length === 0) {
    return res.json({ success: true, drives: [] });
  }

  const clubIds = clubs.map(c => c._id);
  const clubNameMap = new Map(clubs.map(c => [c._id.toString(), c.name]));

  const rangeStart = new Date(Date.UTC(year, month - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, month, 1)); // first day of next month, exclusive

  // Cancelled drives are excluded here to match this app's existing "upcoming/past
  // drives" list conventions elsewhere (ClubDetail.jsx filters them out of both).
  const drives = await Drive.find({
    club: { $in: clubIds },
    isCancelled: false,
    date: { $gte: rangeStart, $lt: rangeEnd }
  })
    .select('name date time startsAt timeZone location club isCompleted')
    .sort({ date: 1, startsAt: 1 })
    .lean();

  const myRsvps = await RSVP.find({ drive: { $in: drives.map(d => d._id) }, user: userId })
    .select('drive status')
    .lean();
  const rsvpMap = new Map(myRsvps.map(r => [r.drive.toString(), r.status]));

  const result = drives.map(d => ({
    _id: d._id,
    name: d.name,
    date: d.date,
    time: d.time,
    startsAt: d.startsAt,
    timeZone: d.timeZone,
    location: d.location,
    isCompleted: d.isCompleted,
    club: { _id: d.club, name: clubNameMap.get(d.club.toString()) || 'Unknown Club' },
    myRsvpStatus: rsvpMap.get(d._id.toString()) || null,
  }));

  res.json({ success: true, drives: result });
});

/**
 * Export a single drive as a calendar event (UC-33)
 * @route GET /api/drives/:driveId/export.ics
 * @access Private (any club member)
 */
const exportDriveIcs = asyncHandler(async (req, res) => {
  const drive = orNotFound(
    await Drive.findById(req.params.driveId).populate('club', 'name members').lean(),
    'Drive not found'
  );
  if (!isClubMember(drive.club, req.user.id)) {
    throw new AppError('You must be a member of this club to export this drive', 403);
  }

  const ics = buildVCalendar([buildVEvent(drive, drive.club.name)]);
  sendIcs(res, `${drive.name.replace(/[^a-z0-9]/gi, '-')}.ics`, ics);
});

/**
 * Export the requesting user's upcoming schedule (UC-33)
 * @route GET /api/drives/my-rsvps/export.ics
 * @access Private
 */
const exportMyScheduleIcs = asyncHandler(async (req, res) => {
  const now = new Date();
  const rsvps = await RSVP.find({ user: req.user.id, status: { $in: ['going', 'maybe'] } })
    .populate({
      path: 'drive',
      select: 'name date time startsAt timeZone location description isCancelled club',
      populate: { path: 'club', select: 'name' }
    })
    .lean();

  const upcoming = rsvps.filter(
    (r) => r.drive && !r.drive.isCancelled && driveStartsAt(r.drive) >= now
  );

  const ics = buildVCalendar(upcoming.map((r) => buildVEvent(r.drive, r.drive.club?.name || 'DriveClique')));
  sendIcs(res, 'driveclique-schedule.ics', ics);
});

module.exports = { getCalendarDrives, exportDriveIcs, exportMyScheduleIcs };
