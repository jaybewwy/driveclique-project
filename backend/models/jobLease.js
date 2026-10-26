const mongoose = require('mongoose');

// Which process may run a scheduled job until when. One document per job, so
// the collection never grows. The API runs as one instance, but a deploy runs
// the old and new ones side by side for a while, and both have the cron.
const JobLeaseSchema = new mongoose.Schema({
  _id: { type: String },
  holder: { type: String, required: true },
  until: { type: Date, required: true },
}, { versionKey: false });

module.exports = mongoose.model('JobLease', JobLeaseSchema);
