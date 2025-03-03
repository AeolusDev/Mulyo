const mongoose = require('mongoose');

// Comment schema
const CommentSchema = new mongoose.Schema({
    apiMangaId: { type: String, required: true },
    chapter_id: { type: String, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    parent_comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    child_comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    text: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
});

const Comment = mongoose.model("Comment", CommentSchema);

module.exports = Comment;