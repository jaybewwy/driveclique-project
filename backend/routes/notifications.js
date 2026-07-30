const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { emitter } = require('../services/notificationEmitter');
const { protect } = require('../middleware/authentication');
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} = require('../controllers/notificationController');

// Lightweight inline auth for SSE (EventSource can't set headers)
const protectSSE = (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).end();
  }
};

/**
 * @route   GET /api/notifications/stream
 * @desc    Server-Sent Events stream for the authenticated user
 * @access  Private (token via query param)
 */
router.get('/stream', protectSSE, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a heartbeat every 25 seconds to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  const userId = req.user.id;

  const onEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  emitter.on(`user:${userId}`, onEvent);

  req.on('close', () => {
    clearInterval(heartbeat);
    emitter.off(`user:${userId}`, onEvent);
  });
});

/**
 * @route   GET /api/notifications
 * @desc    Recent persisted notifications for the authenticated user
 * @access  Private
 */
router.get('/', protect, getMyNotifications);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all of the authenticated user's notifications as read
 * @access  Private
 */
router.put('/read-all', protect, markAllNotificationsRead);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get the authenticated user's per-type notification preferences
 * @access  Private
 */
router.get('/preferences', protect, getNotificationPreferences);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update the authenticated user's per-type notification preferences
 * @access  Private
 */
router.put('/preferences', protect, updateNotificationPreferences);

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put('/:notificationId/read', protect, markNotificationRead);

module.exports = router;
