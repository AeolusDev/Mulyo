const mongoose = require('mongoose');

// Schema for IPs
const ipSchema = new mongoose.Schema({
  ip: String,
  count: Number,
  lastAccessed: Date
});

// Make each IP unique
ipSchema.index({ ip: 1 }, { unique: true });

// Model for IPs
const IP = mongoose.model('ip', ipSchema);

module.exports = IP;