const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const chalk = require('chalk');
const Session = require('../models/sessions');

const validateUserId = (req, res, next) => {
    const userId = req.params.userId;
    const token = req.headers['x-user-token'];
    
    if (!token) {
        console.log(chalk.red('Unauthorized. No token provided'));
        return res.status(401).json({ error: 'Unauthorized. No token provided' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log(chalk.red('Invalid user ID'));
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    try {
      // Use { ignoreExpiration: true } to ignore expiration
      const decodedToken = jwt.verify(token, process.env.SESSION_SECRET, { ignoreExpiration: true });
      
      if(userId === decodedToken.userId){
        // Update session expiration
        refreshSession(token);
        next();
      } else {
        console.log(chalk.red('Forbidden. You are not authorized to perform this action'));
        return res.status(403).json({ error: 'Forbidden. You are not authorized to perform this action' });
      }
    } catch (error) {
      // If error is not due to expiration
      if (error.name !== 'TokenExpiredError') {
        console.log(chalk.red('Unauthorized. Invalid token', error.message));
        return res.status(401).json({ error: 'Unauthorized. Invalid token', errorMessage: error.message });
      }
      
      // If token is expired but valid, try to refresh
      try {
        const decodedToken = jwt.decode(token);
        if (decodedToken && decodedToken.userId) {
          // Update session expiration
          refreshSession(token);
          if (userId === decodedToken.userId) {
            next();
            return;
          }
        }
        console.log(chalk.red('Forbidden. You are not authorized to perform this action'));
        return res.status(403).json({ error: 'Forbidden. You are not authorized to perform this action' });
      } catch (err) {
        console.log(chalk.red('Unauthorized. Invalid token', err.message));
        return res.status(401).json({ error: 'Unauthorized. Invalid token', errorMessage: err.message });
      }
    }
};

const validateCommentId = (req, res, next) => {
    const commentId = req.body.commentId || req.params.commentId;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        console.log(chalk.red('Invalid comment ID'));
        return res.status(400).json({ error: 'Invalid comment ID' });
    }

    next();
};

const validateListId = (req, res, next) => {
    const listId = req.body.listId || req.params.listId;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
        console.log(chalk.red('Invalid list ID'));
        return res.status(400).json({ error: 'Invalid list ID' });
    }

    next();
};

const validateMangaId = (req, res, next) => {
    const apiMangaId = req.params.mangaId;

    if (typeof apiMangaId !== "string" || !apiMangaId) {
        console.log(chalk.red('Invalid api manga ID'));
        return res.status(400).json({ message: "Invalid api manga ID" });
    }

    next();
};

const validateChapterId = (req, res, next) => {
    const chapterId = req.body.chapterId || req.params.chapterId;

    if (typeof chapterId !== "string" || !chapterId) {
        console.log(chalk.red('Invalid chapter ID'));
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    next();
};

// Helper function to refresh session expiration
const refreshSession = async (token) => {
  try {
    const session = await Session.findOne({ token });
    if (session) {
      // Set a very long expiration time (100 years)
      session.expiresAt = Date.now() + (86400000 * 36500); // 100 years
      await session.save();
    }
  } catch (error) {
    console.log(chalk.yellow('Failed to refresh session:', error.message));
  }
};

module.exports = {
    validateUserId,
    validateCommentId,
    validateMangaId,
    validateListId,
    validateChapterId,
    refreshSession
};
