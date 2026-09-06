const { EventEmitter } = require('events');
const Notification = require('../models/notification');
const User = require('../models/user');
const logger = require('../utils/logger');
const { sendPushNotifications } = require('./pushNotificationService');

const emitter = new EventEmitter();
emitter.setMaxListeners(500);

/**
 * Persist a notification for a user, then push it to any live SSE listener
 * and any registered mobile device (Expo push).
 *
 * The database write happens first and is the system of record — if no one
 * is connected when this fires, the notification still exists and is picked
 * up the next time the client fetches history. The SSE emit and the mobile
 * push send are both best-effort convenience layers on top of that, not the
 * only delivery path — this matters most for push, since it's the only path
 * that reaches a backgrounded/closed mobile app at all.
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
      const user = await User.findById(userId).select('notificationPreferences pushTokens').lean();

      // A type explicitly set to false is opted out; anything else (including
      // a type never seen before) is treated as enabled. This gate covers
      // push too, so a muted type is never persisted, streamed, or pushed.
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

      if (user?.pushTokens?.length) {
        const deadTokens = await sendPushNotifications(user.pushTokens, {
          body: record.message,
          data: { type: record.type, ...record.data }
        });
        if (deadTokens.length) {
          await User.updateOne(
            { _id: userId },
            { $pull: { pushTokens: { token: { $in: deadTokens } } } }
          );
        }
      }
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
