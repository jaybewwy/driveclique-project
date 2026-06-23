const express = require('express');
const router  = express.Router();
const { protect }       = require('../middleware/authentication');
const { requireAdmin }  = require('../middleware/requireAdmin');
const { validateInput } = require('../middleware/validation');
const { EVENT_TYPES }    = require('../models/event');
const { trackEvent, getMySummary, getAdminSummary } = require('../controllers/eventController');

router.use(protect);

/**
 * @route   POST /api/events
 * @desc    Record a product-analytics event for the current user
 * @access  Private
 */
router.post(
  '/',
  validateInput({
    type:     { required: true, type: 'string', enum: EVENT_TYPES },
    path:     { type: 'string', maxLength: 500 },
    metadata: { type: 'object' },
  }),
  trackEvent,
);

/**
 * @route   GET /api/events/my-summary
 * @desc    Per-type event counts for the current user
 * @access  Private
 */
router.get('/my-summary', getMySummary);

/**
 * @route   GET /api/events/admin-summary
 * @desc    Aggregate, all-user event analytics
 * @access  Private (admin email allowlist only)
 */
router.get('/admin-summary', requireAdmin, getAdminSummary);

module.exports = router;
