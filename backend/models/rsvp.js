const mongoose = require('mongoose');
const RSVPSchema = new mongoose.Schema({
    drive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Drive',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['going', 'maybe', 'not-going', 'waitlisted'],
        default: 'going'
    }
}, { timestamps: true });

// Unique constraint: one RSVP per user per drive
RSVPSchema.index({ drive: 1, user: 1 }, { unique: true });
// user field queried standalone in getMyRSVPs and waitlist promotion
RSVPSchema.index({ user: 1 });

module.exports = mongoose.model('RSVP', RSVPSchema);
