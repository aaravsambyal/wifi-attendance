const mongoose = require('../lib/mongoose-mock');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  method: { type: String, enum: ['wifi', 'qr', 'qr-only'], required: true },
  ipAddress: { type: String },
  date: { type: Date, default: Date.now },
  leaveDate: { type: Date },
  log: [{
    type: { type: String, enum: ['join', 'leave'] },
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Attendance', attendanceSchema);
