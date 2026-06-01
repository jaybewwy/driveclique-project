const mongoose = require('mongoose');
const crypto = require('crypto');

const ClubSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  description: { 
    type: String, 
    required: true,
    trim: true 
  },
  location: { 
    type: String, 
    trim: true,
    default: '' 
  },
  maxMembers: { 
    type: Number, 
    default: null 
  },
  leader: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  inviteCode: { 
    type: String, 
    unique: true,
    default: function() {
      // Use cryptographically secure random bytes instead of Math.random()
      return crypto.randomBytes(3).toString('hex').toUpperCase();
    }
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  joinRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Club avatar/picture
  avatar: {
    type: String,
    default: ''
  },
  announcements: [{
    title:     { type: String, trim: true, maxlength: 100, default: '' },
    body:      { type: String, required: true, trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Club', ClubSchema);