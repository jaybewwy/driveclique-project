const express = require('express');
const router  = express.Router();
const { protect }       = require('../middleware/authentication');
const { apiLimiter }    = require('../middleware/rateLimiters');
const { validateInput, validateParams, validateQuery } = require('../middleware/validation');
const { REPORT_REASONS, REPORT_STATUSES } = require('../models/report');
const { submitReport, getClubReports, reviewReport } = require('../controllers/reportController');

router.use(protect);
router.use(apiLimiter);

/**
 * @route   POST /api/reports
 * @desc    Submit a content report. `clubId` (optional, user reports only)
 *          is the club the member was reported in; its leaders review it.
 * @access  Private
 */
router.post(
  '/',
  validateInput({
    targetType: { required: true, type: 'string', enum: ['user', 'club', 'drive'] },
    targetId:   { required: true, type: 'string', minLength: 24, maxLength: 24 },
    reason:     { required: true, type: 'string', enum: REPORT_REASONS },
    details:    { type: 'string', maxLength: 500 },
    clubId:     { type: 'string', pattern: /^[0-9a-fA-F]{24}$/ },
  }),
  submitReport,
);

/**
 * @route   GET /api/reports/club/:clubId
 * @desc    A club's report review queue (UC-42): ?status=open (default) or closed
 * @access  Private (Club Leaders/Co-Leaders only)
 */
router.get(
  '/club/:clubId',
  validateParams({ clubId: { required: true, objectId: true } }),
  validateQuery({ status: { enum: ['open', 'closed'] } }),
  getClubReports,
);

/**
 * @route   PUT /api/reports/:reportId
 * @desc    Resolve, dismiss, or reopen a report in a club's review queue (UC-42)
 * @access  Private (Club Leaders/Co-Leaders only)
 */
router.put(
  '/:reportId',
  validateParams({ reportId: { required: true, objectId: true } }),
  validateInput({ status: { required: true, type: 'string', enum: REPORT_STATUSES } }),
  reviewReport,
);

module.exports = router;
