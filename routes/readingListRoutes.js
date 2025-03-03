const express = require('express');
const router = express.Router();

const {
    addNewManga,
    getReadingList,
    getOneManga,
    updateMangaInReadingList,
    deleteAllMangasFromReadingList,
    deleteMangaFromReadingList
} = require('../controllers/readingListController');

const {
    validateUserId,
    validateMangaId,
} = require('../middlewares/validateInput');

const { authMiddleware } = require('../middlewares/auth');

// Add a new manga to a reading list
router.post('/:userId/add-manga/:mangaId', authMiddleware, validateUserId, validateMangaId, addNewManga);

// Get a reading list by ID
router.get('/:userId', authMiddleware, validateUserId, getReadingList);

// Get one manga in reading list
router.get('/:userId/get-manga/:mangaId', authMiddleware, validateUserId, validateMangaId, getOneManga);

// Update manga in reading list
router.put('/:userId/update-manga/:mangaId', authMiddleware, validateUserId, validateMangaId, updateMangaInReadingList);

// Delete all mangas from a reading list
router.delete('/:userId', authMiddleware, validateUserId, deleteAllMangasFromReadingList);

// Delete a manga from a reading list
router.delete('/:userId/delete-manga/:mangaId', authMiddleware, validateUserId, validateMangaId, deleteMangaFromReadingList);

module.exports = router;
