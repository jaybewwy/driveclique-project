const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const Report  = require('../models/report');
const Club    = require('../models/club');
const Drive   = require('../models/drive');
const User    = require('../models/user');
const logger  = require('../utils/logger');
const { emailTemplates } = require('../services/emailService');
const { notifyAndEmail } = require('../services/memberNotifications');
const { hasLeaderPrivileges, isClubMember } = require('../utils/clubPermissions');
const { parsePageParams, paginationMeta } = require('../utils/pagination');

const { CLOSED_REPORT_STATUSES } = Report;

const REASON_LABELS = {
  harassment: 'Harassment or hate speech',
  spam:       'Spam or fake content',
  dangerous:  'Dangerous or illegal activity',
  other:      'Other',
};

// All the review queue shows of a reporter or reviewer
const PERSON_FIELDS = 'username';

// The club fields the reviewer rules below read
const REVIEW_CLUB_FIELDS = 'name leader coLeaders members';

// ─── Who reviews a report (UC-42) ────────────────────────────────────────────
//
// A club's reports go to its leader and co-leaders, with one exception:
// nobody reviews, or is told about, a report made against themselves.

const isAboutUser = (report, userId) =>
  report.targetType === 'user' && report.targetId.toString() === userId.toString();

const reviewerIdsFor = (club, report) => {
  const ids = [club.leader, ...club.coLeaders].map((id) => id.toString());
  return [...new Set(ids)].filter((id) => !isAboutUser(report, id));
};

/**
 * Look up what is being reported. Returns the name to keep on the report and
 * the club whose reviewers handle it (null when no club does).
 */
const resolveTarget = async ({ targetType, targetId, clubId, reporterId }) => {
  if (targetType === 'club') {
    const club = orNotFound(await Club.findById(targetId).select('name'), 'Club not found.');
    // Not sent to the club's own leaders: they are the ones complained about
    return { targetLabel: club.name, reviewClub: null };
  }

  if (targetType === 'drive') {
    const drive = orNotFound(await Drive.findById(targetId).select('name club'), 'Drive not found.');
    const reviewClub = await Club.findById(drive.club).select(REVIEW_CLUB_FIELDS);
    return { targetLabel: drive.name, reviewClub };
  }

  const target = orNotFound(await User.findById(targetId).select('username'), 'User not found.');
  const targetLabel = `@${target.username}`;
  // Reported outside a club: stored, but there is no club to review it
  if (!clubId) return { targetLabel, reviewClub: null };

  const reviewClub = orNotFound(await Club.findById(clubId).select(REVIEW_CLUB_FIELDS), 'Club not found.');
  if (!isClubMember(reviewClub, reporterId)) {
    throw new AppError('You can only report a member to the leaders of a club you belong to.', 403);
  }
  if (!isClubMember(reviewClub, targetId)) {
    throw new AppError('That person is not a member of this club.', 400);
  }
  return { targetLabel, reviewClub };
};

// In-app notification plus email, to the report's reviewers only
const notifyReviewers = async (report, club, reporterId) => {
  // The reporter already knows, even when they are a reviewer themselves
  const reviewerIds = reviewerIdsFor(club, report).filter((id) => id !== reporterId);
  if (reviewerIds.length === 0) return;

  const reporter = await User.findById(reporterId).select('username');
  const reason = REASON_LABELS[report.reason] || report.reason;
  const what = report.targetType === 'drive'
    ? `drive "${report.targetLabel}"`
    : `member ${report.targetLabel}`;

  await notifyAndEmail(reviewerIds, {
    notification: {
      type: 'NEW_REPORT',
      message: `New report in ${club.name}: ${what} (${reason})`,
      data: { clubId: club._id, reportId: report._id },
    },
    email: emailTemplates.reportNotification({
      reporterUsername: reporter?.username || 'a member',
      targetType: report.targetType,
      targetName: report.targetLabel,
      reason,
      details: report.details,
      clubName: club.name,
    }),
  });
};

/**
 * POST /api/reports
 * Submit a report for a user, club, or drive.
 */
const submitReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason, details, clubId } = req.body;
  const reporterId = req.user.id;

  // Block self-reports
  if (targetType === 'user' && targetId === reporterId) {
    throw new AppError('You cannot report yourself.', 400);
  }

  const { targetLabel, reviewClub } = await resolveTarget({ targetType, targetId, clubId, reporterId });

  const key = { reporter: reporterId, targetType, targetId };
  const fields = {
    targetLabel,
    club:       reviewClub?._id || null,
    reason,
    details:    details?.trim() || '',
    status:     'open',
    reportedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
  };

  // One document per reporter and target (the unique index). Reporting the
  // same thing again reopens that report once a reviewer has closed it, and
  // is refused while it is still open.
  let report = await Report.findOneAndUpdate(
    { ...key, status: { $in: CLOSED_REPORT_STATUSES } },
    fields,
    { returnDocument: 'after', runValidators: true }
  );
  if (!report) {
    try {
      report = await Report.create({ ...key, ...fields });
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError('You have already reported this content.', 400);
      }
      throw err;
    }
  }

  // Best-effort: the report is saved either way
  if (reviewClub) {
    notifyReviewers(report, reviewClub, reporterId).catch((err) =>
      logger.error('Failed to notify report reviewers', { reportId: report._id.toString(), error: err.message }));
  }

  res.status(201).json({ success: true, message: 'Your report has been submitted. Thank you.' });
});

/**
 * The current state of each reported drive or member, keyed by id, so a
 * reviewer can tell what has happened to it since. Absent from the map means
 * it has been deleted.
 */
const loadTargets = async (reports, club) => {
  const idsOfType = (type) => reports.filter((r) => r.targetType === type).map((r) => r.targetId);
  const [drives, users] = await Promise.all([
    Drive.find({ _id: { $in: idsOfType('drive') } }).select('name date isCancelled').lean(),
    User.find({ _id: { $in: idsOfType('user') } }).select('username').lean(),
  ]);

  const targets = new Map();
  drives.forEach((d) => targets.set(d._id.toString(), { name: d.name, date: d.date, isCancelled: d.isCancelled }));
  users.forEach((u) => targets.set(u._id.toString(), { username: u.username, isMember: isClubMember(club, u._id) }));
  return targets;
};

/**
 * GET /api/reports/club/:clubId
 * A club's report review queue (UC-42), for its leader and co-leaders.
 * ?status=open (default, newest first) or closed (most recently closed first).
 */
const getClubReports = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const club = orNotFound(await Club.findById(req.params.clubId).select(REVIEW_CLUB_FIELDS), 'Club not found.');
  if (!hasLeaderPrivileges(club, userId)) {
    throw new AppError('Only the club leader or a co-leader can review reports', 403);
  }

  const showClosed = req.query.status === 'closed';
  const paging = parsePageParams(req.query);

  // Everything in this club's queue except reports about the viewer
  const visible = { club: club._id, $nor: [{ targetType: 'user', targetId: userId }] };
  const filter = { ...visible, status: showClosed ? { $in: CLOSED_REPORT_STATUSES } : 'open' };

  const [reports, total, openCount] = await Promise.all([
    Report.find(filter)
      .sort(showClosed ? { reviewedAt: -1 } : { reportedAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate('reporter', PERSON_FIELDS)
      .populate('reviewedBy', PERSON_FIELDS)
      .lean(),
    Report.countDocuments(filter),
    Report.countDocuments({ ...visible, status: 'open' }),
  ]);

  const targets = await loadTargets(reports, club);

  res.json({
    success: true,
    reports: reports.map((report) => ({
      _id:         report._id,
      targetType:  report.targetType,
      targetId:    report.targetId,
      targetLabel: report.targetLabel,
      target:      targets.get(report.targetId.toString()) || null,
      reason:      report.reason,
      details:     report.details,
      status:      report.status,
      reportedAt:  report.reportedAt,
      reporter:    report.reporter,
      reviewedBy:  report.reviewedBy,
      reviewedAt:  report.reviewedAt,
    })),
    openCount,
    pagination: paginationMeta(paging, total, reports.length),
  });
});

/**
 * PUT /api/reports/:reportId
 * Resolve, dismiss, or reopen a report in a club's review queue (UC-42).
 */
const reviewReport = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const userId = req.user.id;

  const report = orNotFound(await Report.findById(req.params.reportId), 'Report not found.');
  // A report no club reviews (club: null) isn't in any queue
  const club = orNotFound(
    report.club && await Club.findById(report.club).select(REVIEW_CLUB_FIELDS),
    'Report not found.'
  );
  if (!hasLeaderPrivileges(club, userId)) {
    throw new AppError('Only the club leader or a co-leader can review reports', 403);
  }
  // Answered like a report that doesn't exist, so it confirms nothing
  if (isAboutUser(report, userId)) {
    throw new AppError('Report not found.', 404);
  }

  const closing = CLOSED_REPORT_STATUSES.includes(status);
  report.status = status;
  report.reviewedBy = closing ? userId : null;
  report.reviewedAt = closing ? new Date() : null;
  await report.save();

  res.json({
    success: true,
    report: { _id: report._id, status: report.status, reviewedBy: report.reviewedBy, reviewedAt: report.reviewedAt },
  });
});

module.exports = { submitReport, getClubReports, reviewReport };
