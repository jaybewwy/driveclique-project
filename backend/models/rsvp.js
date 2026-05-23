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
        enum: ['going', 'maybe', 'not-going'],
        default: 'going'
    }
}, { timestamps: true });

module.exports = mongoose.model('RSVP', RSVPSchema);