// const express = require('express');
// const router = express.Router();

// //Import rate limit middleware
// const { limiter } = require("../middlewares/rateLimit")

// const {
//     addNewManga,
//     getReadingList,
//     getOneManga,
//     updateMangaInReadingList,
//     deleteAllMangasFromReadingList,
//     deleteMangaFromReadingList
// } = require('../controllers/readingListController');

// const {
//     validateUserId,
//     validateMangaId,
// } = require('../middlewares/validateInput');

// const { authMiddleware } = require('../middlewares/auth');

// // Add a new manga to a reading list
// router.post('/:userId/add-manga/:mangaId', limiter, authMiddleware, validateUserId, validateMangaId, addNewManga);

// // Get a reading list by ID
// router.get('/:userId', authMiddleware, validateUserId, getReadingList);

// // Get one manga in reading list
// router.get('/:userId/get-manga/:mangaId', authMiddleware, validateUserId, validateMangaId, getOneManga);

// // Update manga in reading list
// router.put('/:userId/update-manga/:mangaId', limiter, authMiddleware, validateUserId, validateMangaId, updateMangaInReadingList);

// // Delete all mangas from a reading list
// router.delete('/:userId', limiter, authMiddleware, validateUserId, deleteAllMangasFromReadingList);

// // Delete a manga from a reading list
// router.delete('/:userId/delete-manga/:mangaId', limiter, authMiddleware, validateUserId, validateMangaId, deleteMangaFromReadingList);

// module.exports = router;
