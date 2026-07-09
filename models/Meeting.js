const mongoose = require('../lib/mongoose-mock');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostIp: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Meeting', meetingSchema);
