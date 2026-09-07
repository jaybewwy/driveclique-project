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
 * Persistence, SSE, and push are three independent steps, each with its own
 * try/catch: a failure in one (e.g. a dead SSE connection, or an Expo API
 * error) is logged distinctly and never prevents an unrelated, independent
 * later step from running or gets misattributed to the wrong one.
 *
 * Fire-and-forget from the caller's perspective (none of the 14+ call sites
 * across the app await this): the async work below is self-contained with
 * its own catch(es), so a failure here is logged and never becomes an
 * unhandled rejection or blocks the action that triggered it.
 *
 * @param {string} userId
 * @param {{ type: string, message: string, data?: object }} payload
 */
const notify = (userId, payload) => {
  (async () => {
    let record;

    // Steps 1-2: preference check + persist. The DB write is the system of
    // record — if either fails there is nothing downstream to deliver, so
    // this is the only step whose failure is still fatal to the whole call.
    try {
      const user = await User.findById(userId).select('notificationPreferences pushTokens').lean();

      // A type explicitly set to false is opted out; anything else (including
      // a type never seen before) is treated as enabled. This gate covers
      // push too, so a muted type is never persisted, streamed, or pushed.
      if (user?.notificationPreferences?.[payload.type] === false) return;

      record = await Notification.create({
        user: userId,
        type: payload.type,
        message: payload.message,
        data: payload.data || {},
      });

      // Step 3: SSE — isolated so a dead/erroring listener is logged as an
      // SSE-specific problem and never blocks step 4 below.
      try {
        emitter.emit(`user:${userId}`, {
          id: record._id.toString(),
          type: record.type,
          message: record.message,
          data: record.data,
          read: record.read,
          createdAt: record.createdAt,
        });
      } catch (sseError) {
        logger.error('notify(): SSE emit failed', {
          userId,
          type: payload?.type,
          error: sseError.message,
        });
      }

      // Step 4: push — isolated so an Expo API failure or the dead-token
      // cleanup write is logged as a push-specific problem, distinct from
      // persistence (which has already succeeded by this point).
      if (user?.pushTokens?.length) {
        try {
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
        } catch (pushError) {
          logger.error('notify(): push delivery failed', {
            userId,
            type: payload?.type,
            error: pushError.message,
          });
        }
      }
    } catch (error) {
      logger.error('notify(): failed to persist notification', {
        userId,
        type: payload?.type,
        error: error.message,
      });
    }
  })();
};

module.exports = { emitter, notify };
