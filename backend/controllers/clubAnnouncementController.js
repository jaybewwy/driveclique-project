// Club announcements (UC-06), posted and removed by the leader or a co-leader

const Club = require('../models/club');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationEmitter');
const { hasLeaderPrivileges } = require('../utils/clubPermissions');

/**
 * Post an Announcement
 * @route POST /api/clubs/:clubId/announcements
 * @access Private (Club Leaders only)
 */
const postAnnouncement = asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  const userId = req.user.id;

  if (!body?.trim()) throw new AppError('Announcement body is required', 400);

  const club = orNotFound(await Club.findById(req.params.clubId), 'Club not found');
  if (!hasLeaderPrivileges(club, userId)) throw new AppError('Only the club leader or a co-leader can post announcements', 403);

  club.announcements.push({ title: title?.trim() || '', body: body.trim(), createdBy: userId });
  await club.save();

  const newAnnouncement = club.announcements[club.announcements.length - 1];

  // Notify all members via SSE
  club.members.forEach((memberId) => {
    if (memberId.toString() !== userId) {
      notify(memberId.toString(), {
        type: 'NEW_ANNOUNCEMENT',
        message: `${club.name} posted a new announcement`,
        data: { clubId: club._id, clubName: club.name, announcement: newAnnouncement }
      });
    }
  });

  res.status(201).json({ success: true, announcement: newAnnouncement });
});

/**
 * Delete an Announcement
 * @route DELETE /api/clubs/:clubId/announcements/:announcementId
 * @access Private (Club Leaders only)
 */
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { clubId, announcementId } = req.params;

  const club = orNotFound(await Club.findById(clubId), 'Club not found');
  if (!hasLeaderPrivileges(club, req.user.id)) throw new AppError('Only the club leader or a co-leader can delete announcements', 403);

  orNotFound(club.announcements.id(announcementId), 'Announcement not found');

  club.announcements.pull(announcementId);
  await club.save();

  res.json({ success: true, message: 'Announcement deleted' });
});

module.exports = { postAnnouncement, deleteAnnouncement };
