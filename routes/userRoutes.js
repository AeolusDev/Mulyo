const express = require('express');
const router = express.Router();
const { 
  getAllUsers,
  getOneUser,
  createAnonymousUser,
  createUser,
  updateUser,
  deleteUser,
  addBookmark,
  getBookmarks,
  removeBookmark
} = require('../controllers/userController');
const { frontAuthMiddleware } = require('../middlewares/auth');
const { validateUserId } = require('../middlewares/validateInput');

//Import rate limit middleware
const {limiter, limiterAnonymous} = require("../middlewares/rateLimit")

// Import multer
const multer = require('multer');

// Configure multer for file uploads with optimized settings
// Configure multer for file uploads with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    fieldSize: 50 * 1024 * 1024, // 50MB limit for text fields
    files: 1, // Reasonable limit for number of files
    parts: 150 // Slightly more than files limit to account for fields
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]);



// Get all users (requires authentication)
router.get('/', frontAuthMiddleware, getAllUsers);

// Get one user (requires authentication)
router.get('/:userId', frontAuthMiddleware, validateUserId, getOneUser);

// Create a user (no authentication required)
router.post('/createUser', limiter, createUser);

// Create an anonymous user (no authentication required)
router.post('/anonymous', limiterAnonymous, createAnonymousUser);

// Update a user (requires authentication)
router.put('/:userId', limiter, frontAuthMiddleware, validateUserId, upload, updateUser);

// Delete a user (requires authentication)
router.delete('/:userId', limiter, frontAuthMiddleware, validateUserId, deleteUser);

// Get a user's bookmarks (requires authentication)
router.get('/:userId/bookmarks', limiter, frontAuthMiddleware, validateUserId, getBookmarks);

// Add a bookmark to a user (requires authentication)
router.post('/:userId/bookmarks', limiter, frontAuthMiddleware, validateUserId, addBookmark);

// Remove a bookmark from a user (requires authentication)
router.delete('/:userId/bookmarks', limiter, frontAuthMiddleware, validateUserId, removeBookmark);

module.exports = router;