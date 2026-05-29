const Drive = require('../models/Drive');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Create a new Drive/Event
 * @route POST /api/drives
 * @access Private (Club Leaders only)
 */
const createDrive = asyncHandler(async (req, res) => {
  const { clubId, name, date, time, location, description, difficulty, maxAttendees } = req.body;

  // Validate clubId is provided
  if (!clubId) {
    throw new AppError('clubId is required. You must create or select a club first.', 400);
  }

  // Verify club exists
  const club = await Club.findById(clubId);
  if (!club) {
    throw new AppError('Club not found', 404);
  }

  // Verify user is the club leader
  if (club.leader.toString() !== req.user.id) {
    throw new AppError('Only the club leader can create drives for this club', 403);
  }

  // Create the drive
  const newDrive = new Drive({
    club: clubId,
    name,
    date,
    time,
    location,
    description,
    difficulty: difficulty || 'Medium',
    maxAttendees: maxAttendees || 100,
    createdBy: req.user.id
  });

  await newDrive.save();

  res.status(201).json({
    success: true,
    message: 'Drive created successfully!',
    drive: newDrive
  });
});

/**
 * Get all drives for a specific club
 * @route GET /api/drives/club/:clubId
 * @access Private
 */
const getClubDrives = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  
  const drives = await Drive.find({ club: clubId })
    .sort({ date: 1 })
    .populate('createdBy', 'username name');

  res.json({ success: true, drives });
});

/**
 * RSVP to a Drive / Change RSVP Status
 * @route POST /api/drives/:driveId/rsvp
 * @access Private
 */
const rsvpToDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  // Validate RSVP status
  const validStatuses = ['going', 'maybe', 'not-going'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid RSVP status. Must be: going, maybe, or not-going', 400);
  }

  // Verify drive exists
  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Find existing RSVP or create new one
  let rsvp = await RSVP.findOne({ drive: driveId, user: userId });

  if (rsvp) {
    // Update existing RSVP
    rsvp.status = status;
    await rsvp.save();
    
    return res.json({
      success: true,
      message: `RSVP updated to ${status}`,
      rsvp
    });
  }

  // Create new RSVP
  rsvp = new RSVP({
    drive: driveId,
    user: userId,
    status
  });
  await rsvp.save();

  res.json({
    success: true,
    message: `You are now marked as ${status}`,
    rsvp
  });
});

/**
 * Cancel a Drive
 * @route POST /api/drives/:driveId/cancel
 * @access Private (Club Leaders only)
 */
const cancelDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { cancellationReason } = req.body;
  const leaderId = req.user.id;

  // Validate cancellation reason
  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new AppError('Cancellation reason is required', 400);
  }

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can cancel this drive', 403);
  }

  // Update drive cancellation fields
  drive.isCancelled = true;
  drive.cancellationReason = cancellationReason.trim();
  drive.cancelledAt = new Date();
  drive.cancelledBy = leaderId;

  await drive.save();

  res.json({
    success: true,
    message: 'Drive has been cancelled successfully',
    drive
  });
});

/**
 * Get RSVP Counts + Current User's RSVP Status for a Drive
 * @route GET /api/drives/:driveId/rsvp-status
 * @access Private (any authenticated club member)
 */
const getDriveRSVPStatus = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  // Verify drive exists
  const drive = await Drive.findById(driveId);
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Fetch all RSVPs for this drive (only user + status fields needed)
  const rsvps = await RSVP.find({ drive: driveId })
    .select('user status')
    .lean();

  // Calculate counts in a single pass
  const counts = rsvps.reduce(
    (acc, r) => {
      if (r.status === 'going') acc.going++;
      else if (r.status === 'maybe') acc.maybe++;
      else if (r.status === 'not-going') acc.notGoing++;
      return acc;
    },
    { going: 0, maybe: 0, notGoing: 0 }
  );

  // Find the requesting user's own RSVP (if any)
  const userRSVP = rsvps.find(r => r.user.toString() === userId);

  res.json({
    success: true,
    counts,
    userStatus: userRSVP ? userRSVP.status : null,
    totalRSVPs: rsvps.length
  });
});

/**
 * Get Drive Attendees and Stats
 * @route GET /api/drives/:driveId/attendees
 * @access Private (Club Leaders only)
 */
const getDriveAttendees = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const userId = req.user.id;

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== userId) {
    throw new AppError('Only the club leader can view the attendees of this drive', 403);
  }

  // Get all RSVPs with user info in a single query
  const rsvps = await RSVP.find({ drive: driveId })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });

  // Calculate stats using reduce for better efficiency
  const stats = rsvps.reduce((acc, r) => {
    if (r.status === 'going') acc.going++;
    else if (r.status === 'maybe') acc.maybe++;
    else if (r.status === 'not-going') acc.notGoing++;
    return acc;
  }, { going: 0, maybe: 0, notGoing: 0 });

  res.json({
    success: true,
    drive: {
      id: drive._id,
      name: drive.name,
      date: drive.date,
      location: drive.location,
    },
    totalRSVPs: rsvps.length,
    stats: {
      going: stats.going,
      maybe: stats.maybe,
      notGoing: stats.notGoing,
      totalSpots: drive.maxAttendees,
      spotsLeft: Math.max(0, drive.maxAttendees - stats.going)
    },
    rsvps
  });
});

/**
 * Update a Drive (Edit details or mark as complete)
 * @route PUT /api/drives/:driveId
 * @access Private (Club Leaders only)
 */
const updateDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const { name, date, time, location, description, difficulty, maxAttendees, isCompleted } = req.body;
  const leaderId = req.user.id;

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can update this drive', 403);
  }

  // Update fields if provided
  if (name !== undefined) drive.name = name;
  if (date !== undefined) drive.date = date;
  if (time !== undefined) drive.time = time;
  if (location !== undefined) drive.location = location;
  if (description !== undefined) drive.description = description;
  if (difficulty !== undefined) drive.difficulty = difficulty;
  if (maxAttendees !== undefined) drive.maxAttendees = maxAttendees;
  
  // Handle completion status
  if (isCompleted !== undefined) {
    if (isCompleted) {
      drive.isCompleted = true;
      drive.completedAt = new Date();
    } else {
      drive.isCompleted = false;
      drive.completedAt = undefined;
    }
  }

  await drive.save();

  res.json({
    success: true,
    message: 'Drive updated successfully',
    drive
  });
});

/**
 * Delete a Drive
 * @route DELETE /api/drives/:driveId
 * @access Private (Club Leaders only)
 */
const deleteDrive = asyncHandler(async (req, res) => {
  const { driveId } = req.params;
  const leaderId = req.user.id;

  // Find drive with club info
  const drive = await Drive.findById(driveId).populate('club');
  if (!drive) {
    throw new AppError('Drive not found', 404);
  }

  // Verify user is the club leader
  if (drive.club.leader.toString() !== leaderId) {
    throw new AppError('Only the club leader can delete this drive', 403);
  }

  // Delete the drive
  await Drive.findByIdAndDelete(driveId);

  // Also delete associated RSVPs
  await RSVP.deleteMany({ drive: driveId });

  res.json({
    success: true,
    message: 'Drive deleted successfully'
  });
});

/**
 * Get Leader Dashboard Summary
 * @route GET /api/drives/dashboard
 * @access Private (Club Leaders only)
 * 
 * OPTIMIZED: Uses aggregation pipeline to reduce N+1 queries
 */
const getLeaderDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Find all clubs where user is the leader
  const clubs = await Club.find({ leader: userId })
    .select('name description inviteCode members createdAt')
    .lean(); // Use lean() for better performance (read-only objects)

  if (clubs.length === 0) {
    return res.json({
      success: true,
      totalClubs: 0,
      dashboard: []
    });
  }

  const clubIds = clubs.map(club => club._id);

  // Get all drives for these clubs in a single query
  const drives = await Drive.find({ club: { $in: clubIds } })
    .select('_id club name date time location isCancelled maxAttendees')
    .sort({ date: 1 })
    .lean();

  // Get all RSVPs for these drives in a single query
  const driveIds = drives.map(drive => drive._id);
  const rsvps = await RSVP.find({ drive: { $in: driveIds } })
    .select('drive status')
    .lean();

  // Build a map of drive stats for O(1) lookup
  const driveStatsMap = new Map();
  rsvps.forEach(rsvp => {
    const driveIdStr = rsvp.drive.toString();
    if (!driveStatsMap.has(driveIdStr)) {
      driveStatsMap.set(driveIdStr, { going: 0, maybe: 0, notGoing: 0, total: 0 });
    }
    const stats = driveStatsMap.get(driveIdStr);
    stats.total++;
    if (rsvp.status === 'going') stats.going++;
    else if (rsvp.status === 'maybe') stats.maybe++;
    else if (rsvp.status === 'not-going') stats.notGoing++;
  });

  // Build the dashboard response
  const dashboard = clubs.map(club => {
    const clubDrives = drives.filter(d => d.club.toString() === club._id.toString());
    
    const driveSummaries = clubDrives.map(drive => {
      const stats = driveStatsMap.get(drive._id.toString()) || { going: 0, maybe: 0, notGoing: 0, total: 0 };
      
      return {
        _id: drive._id,
        name: drive.name,
        date: drive.date,
        time: drive.time,
        location: drive.location,
        isCancelled: drive.isCancelled || false,
        rsvpStats: {
          going: stats.going,
          maybe: stats.maybe,
          notGoing: stats.notGoing,
          totalRSVPs: stats.total,
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

module.exports = {
  createDrive,
  getClubDrives,
  rsvpToDrive,
  cancelDrive,
  updateDrive,
  deleteDrive,
  getDriveAttendees,
  getDriveRSVPStatus,
  getLeaderDashboard
};
