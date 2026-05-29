const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(500);

/**
 * Emit a notification to all subscribers of a specific user.
 * @param {string} userId
 * @param {{ type: string, message: string, data?: object }} payload
 */
const notify = (userId, payload) => {
  emitter.emit(`user:${userId}`, payload);
};

module.exports = { emitter, notify };
