const express = require('express');
const router = express.Router();
const { getAllUsers, getOneUser, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { frontAuthMiddleware } = require('../middlewares/auth');
const { validateUserId } = require('../middlewares/validateInput');

//Import rate limit middleware
const limiter = require("../middlewares/rateLimit")

// Get all users (requires authentication)
router.get('/', frontAuthMiddleware, getAllUsers);

// Get one user (requires authentication)
router.get('/:userId', frontAuthMiddleware, validateUserId, getOneUser);

// Create a user (no authentication required)
router.post('/createUser', limiter, createUser);

// Update a user (requires authentication)
router.put('/:userId', limiter, frontAuthMiddleware, validateUserId, updateUser);

// Delete a user (requires authentication)
router.delete('/:userId', limiter, frontAuthMiddleware, validateUserId, deleteUser);

module.exports = router;