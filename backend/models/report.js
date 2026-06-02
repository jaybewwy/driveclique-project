const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetType: {
    type: String,
    enum: ['user', 'club', 'drive'],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  reason: {
    type: String,
    enum: ['harassment', 'spam', 'dangerous', 'other'],
    required: true,
  },
  details: {
    type: String,
    maxlength: 500,
    default: '',
  },
  resolved: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// One report per reporter per target — prevents spam-clicking
ReportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Report', ReportSchema);
