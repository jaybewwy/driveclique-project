const mongoose = require('mongoose');

const DriveRatingSchema = new mongoose.Schema({
  drive: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drive',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  stars: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    maxlength: 200,
    default: '',
  },
}, { timestamps: true });

// One rating per user per drive — re-submitting updates the existing rating
DriveRatingSchema.index({ drive: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('DriveRating', DriveRatingSchema);
