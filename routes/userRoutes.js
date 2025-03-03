const express = require('express');
const router = express.Router();
const { getAllUsers, getOneUser, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { frontAuthMiddleware } = require('../middlewares/auth');
const { validateUserId } = require('../middlewares/validateInput');

// Get all users (requires authentication)
router.get('/', frontAuthMiddleware, getAllUsers);

// Get one user (requires authentication)
router.get('/:userId', frontAuthMiddleware, validateUserId, getOneUser);

// Create a user (no authentication required)
router.post('/createUser', createUser);

// Update a user (requires authentication)
router.put('/:userId', frontAuthMiddleware, validateUserId, updateUser);

// Delete a user (requires authentication)
router.delete('/:userId', frontAuthMiddleware, validateUserId, deleteUser);

module.exports = router;