const Comment = require("../models/comment");

const createComment = async (req, res) => {
    try {
        const { apiMangaId, chapterId, userId, text, parent_comment } = req.body;
        const comment = new Comment({
            apiMangaId,
            chapter_id: chapterId,
            user_id: userId,
            text,
            parent_comment,
        });
        await comment.save();

        // Update the parent comment's child_comments array with the ID of the new child comment
        if (parent_comment) {
            await Comment.findByIdAndUpdate(parent_comment, {
                $push: { child_comments: comment._id },
            });
        }

        res.status(201).json(comment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

const getCommentsByChapter = async (req, res) => {
    try {
        const { apiMangaId, chapterId } = req.params;

        // Find top-level comments (i.e. comments without parent_comment)
        const comments = await Comment.find({
            apiMangaId,
            chapter_id: chapterId,
            parent_comment: null,
        })
            .populate({
                path: "user_id",
                select: "username",
            })
            .populate({
                path: "child_comments",
                populate: {
                    path: "user_id",
                    select: "username",
                },
            })
            .sort({ created_at: "asc" });

        // Function to recursively populate child comments
        const populateChildComments = async (comment) => {
            if (comment.child_comments.length === 0) {
                return comment;
            } else {
                comment.child_comments = await Promise.all(
                    comment.child_comments.map(async (childCommentId) => {
                        const childComment = await Comment.findById(childCommentId)
                            .populate({
                                path: "user_id",
                                select: "username",
                            })
                            .populate({
                                path: "child_comments",
                                populate: {
                                    path: "user_id",
                                    select: "username",
                                },
                            });
                        return await populateChildComments(childComment);
                    })
                );
                return comment;
            }
        };

        // Populate child comments recursively for each top-level comment
        const populatedComments = await Promise.all(
            comments.map(async (comment) => {
                return await populateChildComments(comment);
            })
        );

        res.status(200).json(populatedComments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId } = req.body;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Check if the user who is deleting the comment is the one who created it
        if (comment.user_id.toString() !== userId) {
            return res.status(401).json({ message: "Not authorized" });
        }

        await comment.remove();
        res.status(200).json({ message: "Comment deleted successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

module.exports = { createComment, getCommentsByChapter, deleteComment };
