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
        enum: ['Going', 'Not Going', 'Maybe'], // RSVP status options, might replace with boolean if only interested in going/not going
        default: 'Going'
    }
}, { timestamps: true });

module.exports = mongoose.model('RSVP', RSVPSchema);