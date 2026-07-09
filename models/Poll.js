const mongoose = require('../lib/mongoose-mock');

const pollSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  question: { type: String, required: true },
  options: [{
    text: { type: String, required: true },
    votes: { type: Number, default: 0 }
  }],
  votedUsers: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    optionId: { type: mongoose.Schema.Types.ObjectId }
  }],
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Poll', pollSchema);
