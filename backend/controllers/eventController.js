const mongoose = require('mongoose');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Event = require('../models/event');
const { EVENT_TYPES } = Event;

/**
 * POST /api/events
 * Record a single product-analytics event for the authenticated user.
 */
const trackEvent = asyncHandler(async (req, res) => {
  const { type, path, metadata } = req.body;

  if (!EVENT_TYPES.includes(type)) {
    throw new AppError(`Unknown event type: ${type}`, 400);
  }

  await Event.create({
    user: req.user.id,
    type,
    path: path || '',
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  });

  res.status(201).json({ success: true });
});

/**
 * GET /api/events/my-summary
 * Per-type event counts for the requesting user only.
 */
const getMySummary = asyncHandler(async (req, res) => {
  const counts = await Event.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  const summary = {};
  EVENT_TYPES.forEach((type) => { summary[type] = 0; });
  counts.forEach((c) => { summary[c._id] = c.count; });

  res.json({ success: true, summary });
});

/**
 * GET /api/events/admin-summary
 * Aggregate, all-user event analytics. Gated by requireAdmin upstream.
 */
const getAdminSummary = asyncHandler(async (req, res) => {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalsByType, dailyPageViews, activeUsersResult] = await Promise.all([
    Event.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $match: { type: 'PAGE_VIEW', createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Event.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$user' } },
      { $count: 'activeUsers' },
    ]),
  ]);

  const totals = {};
  EVENT_TYPES.forEach((type) => { totals[type] = 0; });
  totalsByType.forEach((t) => { totals[t._id] = t.count; });

  res.json({
    success: true,
    totals,
    dailyPageViews: dailyPageViews.map((d) => ({ date: d._id, count: d.count })),
    activeUsers30d: activeUsersResult[0]?.activeUsers || 0,
  });
});

module.exports = { trackEvent, getMySummary, getAdminSummary };
