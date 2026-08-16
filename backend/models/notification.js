const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'NEW_DRIVE',
  'RSVP_NEW',
  'RSVP_UPDATED',
  'WAITLIST_JOINED',
  'WAITLIST_PROMOTED',
  'DRIVE_CANCELLED',
  'DRIVE_REMINDER',
  'DRIVE_CHECKIN_REQUEST',
  'JOIN_REQUEST',
  'JOIN_ACCEPTED',
  'JOIN_REJECTED',
  'NEW_ANNOUNCEMENT',
  'COLEADER_PROMOTED',
  'COLEADER_DEMOTED',
];

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Every read of this collection is "this user's notifications, newest first"
NotificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
