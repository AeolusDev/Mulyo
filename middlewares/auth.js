const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Get the token from the request headers
    const token = req.headers.authorization;
    if (!token) {
        // Return error response if token is missing
        return res.status(401).json({ message: 'Authentication token missing' });
        console.log('Token is missing \n Origin: ', req.headers.origin);
    }

    try {
        // Verify the token
        let verify = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token verified \n Origin: ', req.headers.origin);
        next();
    } catch (err) {
        // Return error response if token is invalid
        return res.status(401).json({ message: 'Authentication token invalid' });
    }
};

const frontAuthMiddleware = (req, res, next) => {
    // Get the token from the request headers
    const token = req.headers.authorization;
    if (!token) {
        // Return error response if token is missing
        return res.status(401).json({ message: 'Authentication token missing' });
        console.log('Token is missing \n Origin: ', req.headers.origin);
    }

    try {
        // Verify the token
        let verify = jwt.verify(token, process.env.FRONT_JWT_SECRET);
        console.log('Token verified \n Origin: ', req.headers.origin);
        next();
    } catch (err) {
        // Return error response if token is invalid
        return res.status(401).json({ message: 'Authentication token invalid' });
    }
};

module.exports = { authMiddleware, frontAuthMiddleware };
