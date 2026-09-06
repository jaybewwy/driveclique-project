/**
 * Sends push notifications to mobile devices via the Expo Push API.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * No SDK dependency — Expo's push API is a single plain HTTP endpoint, so this
 * uses the same fetch()-with-timeout, fail-open pattern already established
 * for calling external services in this app (see emailVerifier.js). Failures
 * are logged and swallowed; a down/slow push service must never block or
 * throw for the caller (notify(), which is itself fire-and-forget).
 */

const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo's documented max messages per request

/**
 * @param {{token: string}[]} tokens - this user's registered device tokens
 * @param {{title?: string, body: string, data?: object}} notification
 * @returns {Promise<string[]>} tokens Expo reported as permanently invalid
 *   (DeviceNotRegistered) — the caller should stop sending to these
 */
const sendPushNotifications = async (tokens, notification) => {
  if (!tokens?.length) return [];

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title: notification.title || 'DriveClique',
    body: notification.body,
    data: notification.data || {}
  }));

  const deadTokens = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        logger.warn('Expo push API unexpected status', { status: response.status });
        continue;
      }

      const result = await response.json();
      (result.data || []).forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          deadTokens.push(batch[idx].to);
        }
      });
    } catch (err) {
      // Timeout or network error — fail open, same as emailVerifier.js
      logger.warn('Expo push send failed', { error: err.message });
    }
  }

  return deadTokens;
};

module.exports = { sendPushNotifications };
