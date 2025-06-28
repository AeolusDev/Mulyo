const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { checkConnection, connectDB } = require('../utils/db');
const { auth, signInWithEmailAndPassword } = require('../utils/firebase');

// Import models
const Session = require("../models/sessions");
const { User, AnonymousUser } = require('../models/user');
const Admin = require('../models/admin');

// Import sessionVerifier utility
const { verifyUserSession, createOrExtendSession } = require('../utils/sessionVerifier');

const passportLogin = async (req, res) => {
    try {
        if (req.isAuthenticated()) {
            const token = await createOrExtendSession(req.user._id, req.user.username);

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
        const { username, email, password } = req.body;
        // Find the user by email
        const user = await User.findOne({ email });
        const anonymousUser = await AnonymousUser.findOne({ username });

        if (!user && !anonymousUser) {
            return res.status(401).json({ message: 'Authentication failed. User does not exist!' });
        }

        // Special Login for Anon User
        if (anonymousUser) {
            const isMatch = await bcryptjs.compare(password, anonymousUser.password);

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            // Create and Sign a JWT token for anonymous user
            const token = await createOrExtendSession(anonymousUser._id, anonymousUser.username);

            // Return success response with the token
            const userInfo = {
                id: anonymousUser._id,
                email: anonymousUser.email,
                name: anonymousUser.username,
            };

            return res.status(200).json({ token, userInfo });
        }

        // Compare the password with the hashed password
        const isMatch = await bcryptjs.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Create and sign a JWT token
        const token = await createOrExtendSession(user._id, user.username);

        // Return success response with the token
        const userInfo = {
            id: user._id,
            email: user.email,
            name: user.username,
        };

        res.json({
            userInfo,
            message: 'Authentication successful',
            token
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
        console.log(err);
    }
};

const discord = async (req, res) => {
    try {
        const code = req.body.code;

        console.log('Code:', code);

        const params = new URLSearchParams();
        params.append('client_id', process.env.DISCORDCLIENTID);
        params.append('client_secret', process.env.DISCORDCLIENTSECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', `${process.env.DISCORD_REDIRECT_URI}`);

        const response = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log(response.data);
        console.log('Access Token:', response.data.access_token);

        const accessToken = response.data.access_token;
        const account = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const hashedPassword = await bcryptjs.hash(accessToken, 10);

        const pfpLinks = [
        ];

        const profilePicture = pfpLinks[Math.floor(Math.random() * pfpLinks.length)];

        const user = new User({
            username: account.data.username,
            email: account.data.email,
            password: hashedPassword,
            type: 'discord',
            profilePicture: `https://cdn.discordapp.com/avatars/${account.data.id}/${account.data.avatar}.png` || profilePicture,
        });
        
        const existingUser = await User.findOne({ email: account.data.email });

        if (existingUser) {
          res.status(200).json({
              userInfo: account.data,
              token: await createOrExtendSession(existingUser.id, account.data.username),
              id: existingUser.id,
              message: 'Authentication successful'
          });
          
          return;
        }

        user.save();

        res.status(200).json({
            userInfo: account.data,
            token: await createOrExtendSession(user.id, account.data.username),
            id: user.id,
            message: 'Authentication successful'
        });
    } catch (error) {
        console.error('Error exchanging code for token:', error);

        res.status(500).json({ message: error.message });
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
        
        const body = JSON.parse(req.body.toString());
        const { email, password } = body;

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

        // Check if staff is already signed in
        const token = await createOrExtendSession(admin._id, admin.email);

        res.json({
            success: true,
            message: 'Authentication successful',
            role: admin.role,
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
            message: 'Internal server error occurred while trying to login',
            error: err.message
        });
    }
};

const adminLogout = async (req, res) => {
    try {
      const body = JSON.parse(req.body.toString());
      const { email, password } = body;

      console.log(`Debugging adminLogout: email=${email}, \ntoken=${token}`);
        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const existingSession = await Session.findOne({ username: email, token: token });

        if (!existingSession) {
            return res.status(404).json({ message: 'Session not found' });
        }

        await existingSession.deleteOne();
        res.status(200).json({
            success: true,
            message: 'Admin logged out successfully'
        });
    } catch (err) {
        console.error('Admin logout error:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error occurred while trying to logout',
            error: err.message
        });
    }
};

const adminCreate = async (req, res) => {
    try {

      const body = JSON.parse(req.body.toString());
      const { email, password, role } = body;
      
        console.log(email, password, role);
        // Find if admin already exists
        const admin = await Admin.findOne({ email });

        if (admin) {
            return res.status(401).json({ message: 'Admin Account Already Exists' });
        }

        // Generate salt and hash password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        const permissions = [];

        // Create new admin document
        const newAdmin = new Admin({
            email: email,
            password: hashedPassword,
            role: role,
            permissions: permissions || ['read']
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
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create new entry",
            error: error.message,
        });
    }
};

const checkAdmin = async (req, res) => {
    try {
      const body = JSON.parse(req.body.toString());
      const { email, password } = body;
      // Check if user is authenticated
        const admin = await Admin.findOne({ email }).maxTimeMS(5000);

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed. Email not found'
            });
        }

        const role = admin.role;
        const permissions = admin.permissions;

        res.status(200).json({
            success: true,
            message: 'Admin check successful',
            admin: {
                email: admin.email,
                _id: admin._id,
                role,
                permissions
            }
        });
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Error checking admin status'
        });
    }
};

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

const checkRole = async (req, res) => {
    try {
        // Check database connection first
        if (!checkConnection()) {
            await connectDB(); // Try to reconnect if not connected
        }
        const body = JSON.parse(req.body.toString());
        const { email, password } = body;

        console.log('Checking role for email:', email);

        // Add timeout to the query
        const admin = await Admin.findOne({ email }).maxTimeMS(5000);

        console.log('Admin found:', admin);

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed. Account not found.'
            });
        }

        res.json({
            success: true,
            message: admin.role.includes('super-admin') ? 'Authentication successful. User is a super-admin' : 'Authentication successful',
            isSuperAdmin: admin.role.includes('super-admin'),
            role: admin.role,
        });

    } catch (err) {
        console.error('Super-Admin check error:', err);

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

const verifySession = (req, res) => {
  try {
    
    const body = JSON.parse(req.body.toString());
    const token = body.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication failed. Token not provided.'
        });
    }
    
    let verify = verifyUserSession(token);

    res.json({
      success: true,
      message: 'Session verified',
      verifiedUser: verify
    });
    
  }catch(err){
    console.error('Session verification error:', err);

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
  }
}

module.exports = {
    login,
    discord,
    logout,
    passportLogin,
    adminLogin,
    adminCreate,
    checkRole,
    adminLogout,
    verifySession,
    jwtCreate
};
