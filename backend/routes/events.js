const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const { protect }       = require('../middleware/authentication');
const { requireAdmin }  = require('../middleware/requireAdmin');
const { validateInput } = require('../middleware/validation');
const { EVENT_TYPES }    = require('../models/event');
const { trackEvent, getMySummary, getAdminSummary } = require('../controllers/eventController');

const isDev = process.env.NODE_ENV === 'development';

// Generous, per-IP limiter — PageViewTracker fires on every route change for every
// logged-in user, so this needs far more headroom than the auth limiters, but a cap
// still stops a single client from flooding the Event collection.
const eventsLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 60 * 1000,   // 1 min
  max: isDev ? 1000 : 300,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(protect);
router.use(eventsLimiter);

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
