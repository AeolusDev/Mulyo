const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');



const validateUserId = (req, res, next) => {
    const userId = req.params.userId;
    const token = req.headers['x-user-token'];
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized. No token provided' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    try{
      const decodedToken = jwt.verify(token, process.env.SESSION_SECRET);
      
      if(userId === decodedToken.userId){
        next();
      } else {
        return res.status(403).json({ error: 'Forbidden. You are not authorized to perform this action' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized. Invalid token', errorMessage: error.message });
    }
};

const validateCommentId = (req, res, next) => {
    const commentId = req.body.commentId || req.params.commentId;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return res.status(400).json({ error: 'Invalid comment ID' });
    }

    next();
};


const validateListId = (req, res, next) => {
    const listId = req.body.listId || req.params.listId;

    if (!mongoose.Types.ObjectId.isValid(listId)) {
        return res.status(400).json({ error: 'Invalid list ID' });
    }

    next();
};

const validateMangaId = (req, res, next) => {
    const apiMangaId = req.params.mangaId;

    if (typeof apiMangaId !== "string" || !apiMangaId) {
        return res.status(400).json({ message: "Invalid api manga ID" });
    }

    next();
};

const validateChapterId = (req, res, next) => {
    const chapterId = req.body.chapterId || req.params.chapterId;

    if (typeof chapterId !== "string" || !chapterId) {
        return res.status(400).json({ message: "Invalid chapter ID" });
    }

    next();
};

module.exports = {
    validateUserId,
    validateCommentId,
    validateMangaId,
    validateListId,
    validateChapterId
};
