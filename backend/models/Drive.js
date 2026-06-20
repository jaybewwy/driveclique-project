const mongoose = require('mongoose');

const DriveSchema = new mongoose.Schema({
  club: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Club', 
    required: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  date: { 
    type: Date, 
    required: true 
  },
  time: String,
  location: {
    type: String,
    required: true
  },
  // Optional precise meeting-point pin (UC-23) — geocoded from `location` via
  // Nominatim, then draggable to fine-tune. Absent for legacy drives.
  coordinates: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
  },
  description: String,
  difficulty: { 
    type: String, 
    enum: ['Easy', 'Medium', 'Hard'], 
    default: 'Medium' 
  },
  maxAttendees: { 
    type: Number, 
    default: 100 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Cancellation field
  isCancelled: { 
    type: Boolean, 
    default: false 
  },
  cancellationReason: {
      type: String
  },
  cancelledAt: {
      type: Date
  },
  cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
  },
  // Optional route image (base64 or URL)
  image: {
    type: String,
    default: ''
  },
  // Completion field
  isCompleted: {
      type: Boolean,
      default: false
  },
  completedAt: {
      type: Date
  },
  // Check-in request timestamp (UC-08) — re-set on every leader resend, cleared check-in stays open until isCompleted
  checkInRequestedAt: {
      type: Date
  }
}, { timestamps: true });

DriveSchema.index({ club: 1, date: 1 });
// createdBy queried in getClubAnalytics and drive ownership checks
DriveSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Drive', DriveSchema);