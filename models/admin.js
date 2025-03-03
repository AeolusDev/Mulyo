const mongoose = require('mongoose');

// Admin schema
const AdminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true},
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
});

// Index the email field for faster query performance
AdminSchema.index({ email: 1 }, { unique: true }); // Create a unique index on email

const Admin = mongoose.model('Admin', AdminSchema);

module.exports = Admin;