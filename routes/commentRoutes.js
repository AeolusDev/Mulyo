// const express = require("express");
// const router = express.Router();

// //Import rate limit middleware
// const { limiter } = require("../middlewares/rateLimit")

// const { createComment, getCommentsByChapter, deleteComment } = require("../controllers/commentController");
// const { authMiddleware } = require('../middlewares/auth');
// const { validateMangaId, validateChapterId, validateUserId, validateCommentId } = require('../middlewares/validateInput');

// router.post("/", limiter, authMiddleware, validateUserId, validateMangaId, validateChapterId, createComment);
// router.get("/:mangaId/:chapterId", (req, res) => { 
//   if (!req.params.mangaId || !req.params.chapterId) {
//      return res.status(400).json({ error: 'Missing mangaId or chapterId' });
//   }
//   authMiddleware, validateMangaId, validateChapterId, getCommentsByChapter });
// router.delete('/:commentId', (req, res) => { 
//   if (!req.params.commentId) {
//      return res.status(400).json({ error: 'Missing commentId' });
//    }
//   limiter, authMiddleware, validateUserId, validateCommentId, deleteComment});

// module.exports = router;
