const mongoose = require('mongoose');

const DriveSchema = new mongoose.Schema({
  club: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CarClub', 
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
  }
}, { timestamps: true });

module.exports = mongoose.model('Drive', DriveSchema);