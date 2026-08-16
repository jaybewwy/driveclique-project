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
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', UserSchema);