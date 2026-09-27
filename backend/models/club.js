const mongoose = require('mongoose');
const crypto = require('crypto');

const CLUB_TAGS = ['JDM', 'Muscle', 'Off-Road', 'Classic', 'Luxury', 'Track', 'EV', 'Trucks', 'General'];

// Co-leaders are a moderator-tier role (UC-10) — capped small since they're a
// high-trust delegation, matching this app's existing pattern of small caps
// (5 tags, 5 cars per profile).
const MAX_CO_LEADERS = 3;

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
  // Geocoded point for proximity search (UC-46) — set when the leader picks a
  // suggestion from the location autocomplete, cleared when `location` is
  // retyped without picking one. Absent for free-typed and pre-UC-46
  // locations; those clubs simply never match a radius search.
  // `coordinates` must default to undefined, not Mongoose's usual [] for
  // arrays — a Point with an empty coordinate array can't be indexed and
  // makes the whole save fail.
  geo: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined }
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
  // Co-leaders / moderators (UC-10) — a subset of leader powers, promoted by
  // the leader. Always a subset of `members`; capped at MAX_CO_LEADERS.
  coLeaders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // UC-32 — users a leader/co-leader has banned after removing them, so they
  // can't immediately rejoin (public club) or re-request (private club/invite
  // code). Never overlaps with `members` — removal always precedes a ban.
  bannedUsers: [{
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
  tags: {
    type: [String],
    default: [],
    enum: CLUB_TAGS
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

// leader is queried heavily: getLeaderDashboard, analytics, drive ownership checks
ClubSchema.index({ leader: 1 });
// members array is used in $in lookups (getUserClubs, analytics member counts)
ClubSchema.index({ members: 1 });
// coLeaders is used in $or lookups alongside leader (getLeaderDashboard, analytics)
ClubSchema.index({ coLeaders: 1 });
// $geoNear in searchClubs (UC-46) requires a geospatial index. 2dsphere
// indexes skip documents with no `geo` field, so un-geocoded clubs cost nothing.
ClubSchema.index({ geo: '2dsphere' });

module.exports = mongoose.model('Club', ClubSchema);
module.exports.CLUB_TAGS = CLUB_TAGS;
module.exports.MAX_CO_LEADERS = MAX_CO_LEADERS;