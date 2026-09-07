const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  name: {
    type: String,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  avatar: {
    type: String,
    default: ''
  },
  cars: {
    type: [{
      year: { type: String, trim: true },
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      color: { type: String, trim: true },
      nickname: { type: String, trim: true, maxlength: 50 },
      photos: { type: [String], default: [] },
      isPrimary: { type: Boolean, default: false }
    }],
    default: []
  },
  role: { 
    type: String, 
    enum: ['user', 'leader'], 
    default: 'user' 
  },
  useDisplayName: {
    type: Boolean,
    default: false
  },
  passwordResetToken: {
    type: String,
    default: undefined
  },
  passwordResetExpires: {
    type: Date,
    default: undefined
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifyToken: {
    type: String,
    default: undefined
  },
  emailVerifyExpiry: {
    type: Date,
    default: undefined
  },
  // A change-email request in progress. The current `email` field is left
  // untouched (and keeps working for login) until the link sent to
  // `pendingEmail` is actually clicked — see confirmEmailChange (UC-28).
  pendingEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: undefined
  },
  emailChangeToken: {
    type: String,
    default: undefined
  },
  emailChangeExpires: {
    type: Date,
    default: undefined
  },
  usernameChangedAt: {
    type: Date,
    default: null
  },
  passwordHistory: {
    type: [String],
    default: []
  },
  // Per-notification-type opt-out map, e.g. { DRIVE_REMINDER: false }.
  // A type absent from this object is treated as enabled (default-on for
  // new types added later, with no migration needed).
  notificationPreferences: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Expo push tokens for this user's mobile devices. A user can be logged in
  // on more than one device, so this is an array rather than a single field;
  // capped and de-duplicated by token value in the controller.
  pushTokens: {
    type: [{
      token: { type: String, required: true },
      platform: { type: String, enum: ['ios', 'android', 'web', 'unknown'], default: 'unknown' }
    }],
    default: []
  },
  // UC-32 — users this account has blocked. One-directional: only affects
  // what the blocked user can do toward the blocker (currently: viewing the
  // blocker's public profile), never the reverse. Not enforced against
  // reporting — blocking someone must not be usable to suppress a
  // legitimate report against you.
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Clubs this user has blocked — the reciprocal of a leader/co-leader's
  // per-club ban (Club.bannedUsers): a user-initiated restriction rather
  // than a leader-initiated one. Hides the club from search/browse for this
  // user and blocks future joins (direct join, join request, invite code)
  // until unblocked. Only ever populated for clubs the user isn't currently
  // a member of — blocking is offered only after leaving.
  blockedClubs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Club'
  }]
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', UserSchema);