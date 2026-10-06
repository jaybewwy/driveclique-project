const mongoose = require('mongoose');

const REPORT_REASONS = ['harassment', 'spam', 'dangerous', 'other'];

// A report is 'open' until one of its club's reviewers closes it (UC-42)
const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];
const CLOSED_REPORT_STATUSES = ['resolved', 'dismissed'];

const ReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetType: {
    type: String,
    enum: ['user', 'club', 'drive'],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  // The target's name when it was reported, so the review queue can still say
  // what it was after the drive or the account is gone
  targetLabel: {
    type: String,
    default: '',
  },
  // The club whose leader and co-leaders review this report (UC-42): a
  // drive's club, or the club a member was reported in. Null for a report on
  // a club itself and for a user reported outside any club; no club's
  // reviewers see those.
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Club',
    default: null,
  },
  reason: {
    type: String,
    enum: REPORT_REASONS,
    required: true,
  },
  details: {
    type: String,
    maxlength: 500,
    default: '',
  },
  status: {
    type: String,
    enum: REPORT_STATUSES,
    default: 'open',
  },
  // When it was filed, or filed again after being closed (see the index below)
  reportedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// One report per reporter per target — prevents spam-clicking, and keeps the
// collection bounded: filing again after a report is closed reopens the same
// document rather than adding one
ReportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

// A club's review queue: its open reports, newest first
ReportSchema.index({ club: 1, status: 1, reportedAt: -1 });

const Report = mongoose.model('Report', ReportSchema);
module.exports = Report;
module.exports.REPORT_REASONS = REPORT_REASONS;
module.exports.REPORT_STATUSES = REPORT_STATUSES;
module.exports.CLOSED_REPORT_STATUSES = CLOSED_REPORT_STATUSES;
