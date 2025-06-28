const mongoose = require('mongoose');

// User schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    type: { type: String, required: true, default: 'UNKNOWN' },
    bio: { type: String },
    profilePicture: { type: String },
    banner: { type: String },
    created_at: { type: Date, default: Date.now },
});

// Anonymous User schema
const AnonymousUserSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    type: { type: String, required: true, default: 'ANONYMOUS' },
    bio: { type: String },
    profilePicture: { type: String },
    banner: { type: String },
    created_at: { type: Date, default: Date.now },
});

// Bookmarks schema
const BookmarkSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    bookmarks: [{
        series: { type: String, required: true },
        thumbnail: { type: String, required: true },
        rating: { type: Number, default: 0 },
        lastRead: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now },
        likedChapters: { type: [Number], default: [] }
    }],
    created_at: { type: Date, default: Date.now },
});

// Index the email field for faster query performance
UserSchema.index({ email: 1 }, { unique: true }); // Create a unique index on email
AnonymousUserSchema.index({ uid: 1, username: 1 }, { unique: true }); // Create a unique index on uid and username

const User = mongoose.model('User', UserSchema);
const AnonymousUser = mongoose.model('AnonymousUser', AnonymousUserSchema);
const Bookmark = mongoose.model('Bookmark', BookmarkSchema);

module.exports = { User, AnonymousUser, Bookmark };