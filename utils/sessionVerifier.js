// utils/sessionVerifier.js
const jwt = require('jsonwebtoken');
const { User, AnonymousUser } = require('../models/user');
const Session = require('../models/sessions');

/**
 * Verifies the user's session token and returns user data
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object>} - User data if valid
 */
const verifyUserSession = async (token) => {
  try {
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    
    if (!decoded || !decoded.userId) {
      throw new Error('Invalid token');
    }
    
    // Find user by ID
    const user = await User.findById(decoded.userId);
    const anonymousUser = await AnonymousUser.findById(decoded.userId);
    
    if (!user && !anonymousUser) {
      throw new Error('User not found');
    }
    
    // Return user data
    return {
      userId: decoded.userId,
      username: user ? user.username : anonymousUser.username,
      email: user ? user.email : null,
      isAnonymous: !user && !!anonymousUser
    };
  } catch (error) {
    console.error('Session verification error:', error.message);
    throw error;
  }
};

/**
 * Creates a new session or extends existing session
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @returns {Promise<string>} - JWT token
 */
const createOrExtendSession = async (userId, username) => {
  try {
    // Check for existing session
    const existingSession = await Session.findOne({ id: userId });
    
    if (existingSession) {
      // Set a very long expiration time (100 years)
      existingSession.expiresAt = Date.now() + (86400000 * 36500); // 100 years
      await existingSession.save();
      return existingSession.token;
    }
    
    // Create new token with no expiration
    const token = jwt.sign(
      { userId: userId },
      process.env.SESSION_SECRET
      // Removed expiresIn to make token never expire
    );
    
    // Create new session with very long expiration
    const session = new Session({
      id: userId,
      username,
      token,
      sessionType: 'user', 
      expiresAt: Date.now() + (86400000 * 36500) // 100 years
    });
    
    await session.save();
    return token;
  } catch (error) {
    console.error('Session creation error:', error.message);
    throw error;
  }
};

module.exports = {
  verifyUserSession,
  createOrExtendSession
};