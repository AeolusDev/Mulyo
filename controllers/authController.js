const User = require('../models/user');
const Admin = require('../models/admin');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { checkConnection, connectDB } = require('../utils/db');
const {auth, signInWithEmailAndPassword } = require('../utils/firebase');

const passportLogin = (req, res) => {
    try {
        if (req.isAuthenticated()) {
            const token = jwt.sign(
                { userId: req.user._id },
                process.env.SESSION_SECRET,
                { expiresIn: "1d" }
            );

            // Redirect to the frontend with the token as a query parameter
            res.redirect(`${process.env.CLIENT_URL}/login/success?token=${token}&userId=${req.user._id}`);
        } else {
            // User is not authenticated, return a response indicating so
            res.redirect(`${process.env.CLIENT_URL}/login?error=Google Authentication failed`);
        }
    } catch (err) {
        res.redirect(`${process.env.CLIENT_URL}/login?error=${err.message}`);
    }
};



// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find the user by email
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ message: 'Authentication failed' });
        }
        // Compare the password with the hashed password
        const isMatch = await bcryptjs.compare(password, user.password);
        
        const firebaseUser = await signInWithEmailAndPassword(auth, email, password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }
        // Create and sign a JWT token
        const token = jwt.sign({ userId: user._id }, process.env.SESSION_SECRET, { expiresIn: '1d' });
        // Return success response with the token
        const userInfo = {
            id: user._id,
            email: user.email,
            name: user.username,
        };
        res.json({
            userInfo,
            message: 'Authentication successful',
            token,
            firebaseUser
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
        console.log(err);
    }
};

const logout = (req, res) => {
    // Perform user logout
    req.logout((err) => {
        if (err) {
            // Handle logout error
            return res.status(500).json({ success: false, msg: "Logout failed.", error: err });
        }
        // Redirect to the login page after successful logout
        return res.redirect(`${process.env.CLIENT_URL}/login`);
    });
};

const adminLogin = async (req, res) => {
    try {
        // Check database connection first
        if (!checkConnection()) {
            await connectDB(); // Try to reconnect if not connected
        }

        const { email, password } = req.body;

        // Add timeout to the query
        const admin = await Admin.findOne({ email }).maxTimeMS(5000);

        if (!admin) {
            return res.status(401).json({ 
                success: false,
                message: 'Authentication failed' 
            });
        }

        const isMatch = await bcryptjs.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid password' 
            });
        }

        const token = jwt.sign(
            { userId: admin._id }, 
            process.env.AUTH_SESSION_TOKEN, 
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: 'Authentication successful',
            token
        });

    } catch (err) {
        console.error('Admin login error:', err);
        
        if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
            return res.status(503).json({
                success: false,
                message: 'Database connection timeout. Please try again.'
            });
        }

        res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

const adminCreate = async (req, res) => { 
  try {
    const { email, password } = req.body;
      
        // Find if admin already exists
        const admin = await Admin.findOne({ email });
        
        if (admin) {
            return res.status(401).json({ message: 'Admin Account Already Exists' });
        }
        
        // Generate salt and hash password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);
        
        // Create new admin document
        const newAdmin = new Admin({
          email: email,
          password: hashedPassword 
        });
    
        // Save the new admin
        await newAdmin.save();
        
        res.status(200).json({
          success: true,
          message: "Admin added to Database successfully",
          admin: {
            email: newAdmin.email,
            _id: newAdmin._id
          }
        });    
  }catch(error){
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create new entry",
      error: error.message,
    });
  }
}

const jwtCreate = async (req, res) => {
  try {
    // Check if token exists in request body
    if (!req.body || !req.body.token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required in request body'
      });
    }

    // Sign the token with additional options for better security
    const token = jwt.sign(
      { data: req.body.token }, // Wrap the token data in an object
      process.env.FRONT_JWT_SECRET,
      {
        algorithm: 'HS256' // Specify the algorithm
      }
    );

    return res.status(200).json({
      success: true,
      token: token
    });
  } catch (error) {
    console.error('JWT signing error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error generating token'
    });
  }
};

module.exports = {
    login,
    logout,
    passportLogin,
    adminLogin,
    adminCreate,
    jwtCreate
};
