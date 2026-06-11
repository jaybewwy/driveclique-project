const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Report  = require('../models/report');
const Club    = require('../models/club');
const Drive   = require('../models/drive');
const User    = require('../models/user');
const { sendEmail, emailTemplates } = require('../services/emailService');

const REASON_LABELS = {
  harassment: 'Harassment or hate speech',
  spam:       'Spam or fake content',
  dangerous:  'Dangerous or illegal activity',
  other:      'Other',
};

/**
 * POST /api/reports
 * Submit a report for a user, club, or drive.
 */
const submitReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason, details } = req.body;
  const reporterId = req.user.id;

  // Block self-reports
  if (targetType === 'user' && targetId === reporterId) {
    throw new AppError('You cannot report yourself.', 400);
  }

  // Verify target exists
  let targetName = '';
  let leaderEmail = null;
  let leaderUser  = null;
  let clubName    = 'DriveClique';

  if (targetType === 'club') {
    const club = await Club.findById(targetId).populate('leader', 'email emailVerified');
    if (!club) throw new AppError('Club not found.', 404);
    targetName  = club.name;
    clubName    = club.name;
    leaderUser  = club.leader;
    leaderEmail = club.leader?.emailVerified !== false ? club.leader?.email : null;

  } else if (targetType === 'drive') {
    const drive = await Drive.findById(targetId).populate({ path: 'club', populate: { path: 'leader', select: 'email emailVerified' } });
    if (!drive) throw new AppError('Drive not found.', 404);
    targetName  = drive.name;
    clubName    = drive.club?.name || 'DriveClique';
    leaderUser  = drive.club?.leader;
    leaderEmail = leaderUser?.emailVerified !== false ? leaderUser?.email : null;

    // Don't notify leader if they're the one being reported
    if (leaderUser?._id?.toString() === targetId) leaderEmail = null;

  } else if (targetType === 'user') {
    const target = await User.findById(targetId).select('username');
    if (!target) throw new AppError('User not found.', 404);
    targetName = `@${target.username}`;
    // No specific club to notify; email goes nowhere for user reports (no platform admin yet)
  }

  // Create report — unique index prevents duplicates
  try {
    await Report.create({
      reporter:   reporterId,
      targetType,
      targetId,
      reason,
      details:    details?.trim() || '',
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('You have already reported this content.', 400);
    }
    throw err;
  }

  // Notify the club leader by email (best-effort)
  if (leaderEmail) {
    const reporter = await User.findById(reporterId).select('username');
    const { subject, html } = emailTemplates.reportNotification({
      reporterUsername: reporter?.username || 'a member',
      targetType,
      targetName,
      reason:   REASON_LABELS[reason] || reason,
      details:  details?.trim() || '',
      clubName,
    });
    sendEmail({ to: leaderEmail, subject, html }); // fire-and-forget
  }

  res.status(201).json({ success: true, message: 'Your report has been submitted. Thank you.' });
});

module.exports = { submitReport };
