const { EventEmitter } = require('events');
const Notification = require('../models/notification');
const User = require('../models/user');
const logger = require('../utils/logger');

const emitter = new EventEmitter();
emitter.setMaxListeners(500);

/**
 * Persist a notification for a user, then push it to any live SSE listener.
 *
 * The database write happens first and is the system of record — if no one
 * is connected when this fires, the notification still exists and is picked
 * up the next time the client fetches history. The SSE emit is a best-effort
 * convenience layer on top of that, not the only delivery path.
 *
 * Fire-and-forget from the caller's perspective (none of the 14+ call sites
 * across the app await this): the async work below is self-contained with
 * its own catch, so a DB failure here is logged and never becomes an
 * unhandled rejection or blocks the action that triggered it.
 *
 * @param {string} userId
 * @param {{ type: string, message: string, data?: object }} payload
 */
const notify = (userId, payload) => {
  (async () => {
    try {
      const user = await User.findById(userId).select('notificationPreferences').lean();

      // A type explicitly set to false is opted out; anything else (including
      // a type never seen before) is treated as enabled.
      if (user?.notificationPreferences?.[payload.type] === false) return;

      const record = await Notification.create({
        user: userId,
        type: payload.type,
        message: payload.message,
        data: payload.data || {},
      });

      emitter.emit(`user:${userId}`, {
        id: record._id.toString(),
        type: record.type,
        message: record.message,
        data: record.data,
        read: record.read,
        createdAt: record.createdAt,
      });
    } catch (error) {
      logger.error('Failed to persist/deliver notification', {
        userId,
        type: payload?.type,
        error: error.message,
      });
    }
  })();
};

module.exports = { emitter, notify };
