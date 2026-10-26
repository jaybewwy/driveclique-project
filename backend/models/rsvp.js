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
    },
    // When this RSVP last took a place ("going"); decides who keeps one when
    // more members took places at once than the drive has (services/waitlist.js).
    // Absent on RSVPs from before 2026-10-26, which count as first.
    goingSince: {
        type: Date
    },
    reminderSent: {
        type: Boolean,
        default: false
    },
    checkedIn: {
        type: String,
        enum: ['pending', 'present', 'not-present'],
        default: 'pending'
    },
    checkedInAt: {
        type: Date
    }
}, { timestamps: true });

// Unique constraint: one RSVP per user per drive
RSVPSchema.index({ drive: 1, user: 1 }, { unique: true });
// user field queried standalone in getMyRSVPs and waitlist promotion
RSVPSchema.index({ user: 1 });

module.exports = mongoose.model('RSVP', RSVPSchema);
