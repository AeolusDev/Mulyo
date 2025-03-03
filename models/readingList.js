const mongoose = require('mongoose');

const ReadingListSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mangas: [{
        manga: { type: String, required: true },
        title: { type: String },
        manga_status: { type: String },
        statistics: {
            follow: { type: Number },
            rating: { type: Number },
        },
        status: { type: String },
        created_at: { type: Date, default: Date.now }
    }]
});

const ReadingList = mongoose.model('ReadingList', ReadingListSchema);

module.exports = ReadingList;
