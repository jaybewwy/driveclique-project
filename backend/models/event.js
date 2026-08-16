const mongoose = require('mongoose');

const EVENT_TYPES = [
  'PAGE_VIEW',
  'CLUB_CREATED',
  'CLUB_JOINED',
  'DRIVE_SCHEDULED',
  'RSVP_SUBMITTED',
  'RATING_SUBMITTED',
  'REPORT_SUBMITTED',
  'AUTHZ_DENIED',
];

const EventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: EVENT_TYPES,
    required: true,
  },
  path: {
    type: String,
    default: '',
    maxlength: 500,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

EventSchema.index({ type: 1, createdAt: -1 });
EventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Event', EventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
