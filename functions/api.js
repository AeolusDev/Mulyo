// Core Modules
const express = require("express");
const bodyParser = require("body-parser");
const serverless = require("serverless-http");
const jwt = require('jsonwebtoken')
// Third-party Modules
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const compression = require("compression");
const passport = require("passport");

// Environment Configuration
require("dotenv").config();

//CORS Configuration 
const isDevelopment = process.env.NODE_ENV === 'development';
console.log('CORS Check - Environment:', process.env.NODE_ENV);

// Define allowed origins

const productionOrigins = [
  'https://your-site.com'
];

const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8888',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8888'
];

const whitelist = isDevelopment 
  ? [...developmentOrigins, ...productionOrigins]
  : productionOrigins;

const corsOptions = {
  origin: function (origin, callback) {
    console.log('\n=== CORS Check ===');
    console.log('Request Origin:', origin);
    console.log('Current Environment:', process.env.NODE_ENV);

    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) {
      console.log('No origin - allowed');
      return callback(null, true);
    }

    try {
      if (isDevelopment) {
        const isLocalhost = origin.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
        if (isLocalhost) {
          console.log('Development localhost origin - allowed:', origin);
          return callback(null, true);
        }
      }

      if (whitelist.includes(origin)) {
        console.log('Whitelisted origin - allowed:', origin);
        return callback(null, true);
      }

      // Allow Google domains
      if (origin.match(/^https:\/\/(accounts|play)\.google\.com$/)) {
        return callback(null, true);
      }

      console.log('Origin rejected:', origin);
      callback(new Error(`CORS policy violation: ${origin} not allowed`));
    } catch (error) {
      console.error('CORS check error:', error);
      callback(error);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-user-token'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
};


// Configure serverless options for larger payloads
const serverlessConfig = {
  binary: ['multipart/form-data'],
  request: {
    // Increase maximum payload size to 100MB
    maxRequestSize: 100 * 1024 * 1024,
    // Increase body parser limit
    bodyParserLimit: '100mb'
  }
};

const app = express();

app.use((req, res, next) => {
  // Log all incoming requests
  console.log('\n=== Incoming Request ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Origin:', req.headers.origin);
  console.log('Headers:', req.headers);
  next();
});

//Use CORS
app.use(cors(corsOptions))

// Add error handling for CORS
app.use((err, req, res, next) => {
  if (err.message.includes('CORS')) {
    console.error('CORS Error:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      error: err.message
    });
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: err.message,
      origin: req.headers.origin
    });
  }
  next(err);
});

// Custom Modules
const { connectDB } = require("../utils/db");
const connectCloudinary = require("../utils/cloudinary");
const corsMiddleware = require('../middlewares/createCorsMiddleware');
const requestLogger = require('../middlewares/requestLogger');


// Connect to services
connectDB();
connectCloudinary();

require("../utils/passport");

// Routes
const authRouter = require("../routes/authRoutes");
const userRoutes = require("../routes/userRoutes");
const readingListRoutes = require("../routes/readingListRoutes");
const commentRoutes = require("../routes/commentRoutes");
const seriesRouters = require("../routes/seriesRoutes");

app.set('trust proxy', true)

// Apply middlewares in correct order
app.use(requestLogger);

// Configure body parser for larger payloads
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ 
  extended: true,
  limit: '100mb',
  parameterLimit: 50000
}));

// Add raw body parser for large files
app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  bodyParser.raw({ 
    limit: '100mb',
    type: ['application/octet-stream', 'multipart/form-data']
  })(req, res, next);
});

// Instead, add a simple request duration check middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Add a listener for when the response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 300000) { // 5 minutes
      console.warn(`Request took longer than expected: ${duration}ms`);
    }
  });

  next();
});

// Update the error handler to include timeout errors
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof SyntaxError || err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Payload too large or malformed',
      error: err.message
    });
  }
  
  if (err.code === 'ETIMEDOUT') {
    return res.status(408).json({
      success: false,
      message: 'Request timeout',
      error: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Initialize database connection
(async () => {
    try {
        await connectDB();
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
})();


// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

app.use(compression());

// Initialize Passport after session middleware
app.use(passport.initialize());
app.use(passport.session());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'PassportError') {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=Authentication failed`);
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});


// Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRoutes);
app.use("/api/readingList", readingListRoutes);
app.use("/api/comment", commentRoutes);
app.use("/api/admin", seriesRouters);


module.exports.handler = serverless(app, serverlessConfig);
