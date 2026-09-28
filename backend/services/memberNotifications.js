const User = require('../models/user');
const { notify } = require('./notificationEmitter');
const { sendEmail } = require('./emailService');

/**
 * Map of userId -> email for the given users whose address isn't known-bad.
 * `emailVerified !== false` rather than `=== true` keeps accounts created
 * before verification existed (no field at all) on the mailing list.
 */
const getVerifiedEmails = async (userIds) => {
  const users = await User.find({
    _id: { $in: userIds },
    emailVerified: { $ne: false },
  }).select('_id email').lean();
  return new Map(users.map((u) => [u._id.toString(), u.email]));
};

/**
 * Send one in-app notification (SSE + push, via notify()) to each user, plus
 * the same email to each one with a verified address. Both channels are
 * fire-and-forget, like notify() and sendEmail() themselves.
 *
 * @param {Array} userIds - ObjectIds or strings
 * @param {object} options
 * @param {{ type, message, data }} options.notification
 * @param {{ subject, html }} [options.email] - omit to skip email
 * @param {string} [options.excludeUserId] - usually the user who triggered it
 * @param {Map} [options.verifiedEmails] - a getVerifiedEmails() result to
 *   reuse, when one call site notifies the same people several times
 */
const notifyAndEmail = async (userIds, { notification, email, excludeUserId, verifiedEmails }) => {
  const recipients = userIds
    .map((id) => id.toString())
    .filter((id) => id !== excludeUserId);
  if (recipients.length === 0) return;

  const emails = email ? (verifiedEmails || await getVerifiedEmails(recipients)) : new Map();

  recipients.forEach((id) => {
    notify(id, notification);
    const address = emails.get(id);
    if (address) sendEmail({ to: address, ...email });
  });
};

module.exports = { getVerifiedEmails, notifyAndEmail };
