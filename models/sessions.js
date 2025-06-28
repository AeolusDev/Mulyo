const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, required: true },
  token: { type: String, required: true },
  sessionType: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Index the email field for faster query performance
SessionSchema.index({ id: 1 }, { unique: true }); // Create a unique index on email

const Session = mongoose.model('Session', SessionSchema);

module.exports = Session;