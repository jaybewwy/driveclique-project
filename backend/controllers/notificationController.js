const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Notification = require('../models/notification');
const User = require('../models/user');

const formatNotification = (n) => ({
  id: n._id.toString(),
  type: n.type,
  message: n.message,
  data: n.data,
  read: n.read,
  createdAt: n.createdAt,
});

/**
 * GET /api/notifications
 * Recent persisted notifications for the authenticated user, newest first.
 */
const getMyNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  const notifications = await Notification.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: { notifications: notifications.map(formatNotification) },
  });
});

/**
 * PUT /api/notifications/:notificationId/read
 * Mark a single notification as read. Scoped to the owner so one user
 * can never mark another user's notification as read via a guessed ID.
 */
const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, user: req.user.id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  res.json({ success: true, data: { notification: formatNotification(notification) } });
});

/**
 * PUT /api/notifications/read-all
 * Mark every unread notification for the authenticated user as read.
 */
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user.id, read: false },
    { read: true }
  );

  res.json({ success: true, message: 'All notifications marked as read' });
});

/**
 * GET /api/notifications/preferences
 */
const getNotificationPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('notificationPreferences').lean();
  res.json({
    success: true,
    data: { notificationPreferences: user?.notificationPreferences || {} },
  });
});

/**
 * PUT /api/notifications/preferences
 * Body: a partial map of { NOTIFICATION_TYPE: boolean }, merged into the
 * user's existing preferences rather than replacing them wholesale.
 */
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new AppError('Preferences must be an object of notification type to boolean', 400);
  }

  for (const [type, value] of Object.entries(updates)) {
    if (!Notification.NOTIFICATION_TYPES.includes(type)) {
      throw new AppError(`Unknown notification type: ${type}`, 400);
    }
    if (typeof value !== 'boolean') {
      throw new AppError(`Preference value for ${type} must be a boolean`, 400);
    }
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.notificationPreferences = { ...(user.notificationPreferences || {}), ...updates };
  await user.save();

  res.json({
    success: true,
    data: { notificationPreferences: user.notificationPreferences },
  });
});

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
};
