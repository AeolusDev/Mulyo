// Core Modules
const express = require("express");
const bodyParser = require("body-parser");
const serverless = require("serverless-http");
const jwt = require('jsonwebtoken');
const router = express.Router();

// Third-party Modules
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const compression = require("compression");
const passport = require("passport");
const chalk = require('chalk');
const cache = require('memory-cache');

// Environment Configuration
require("dotenv").config();

// CORS Configuration 
const isDevelopment = process.env.NODE_ENV === 'development';
console.log('CORS Check - Environment:', process.env.NODE_ENV);

// Define allowed origins
const productionOrigins = [
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

// Create a connection pool cache - prevents new connections on each cold start
let dbConnection = null;
let cloudinaryConnection = null;

// Reuse connections where possible to improve cold start performance
const getDbConnection = async () => {
  const { connectDB } = require("../utils/db");
  if (!dbConnection) {
    console.log('Creating new database connection');
    dbConnection = await connectDB();
  }
  return dbConnection;
};

const getCloudinaryConnection = () => {
  const connectCloudinary = require("../utils/cloudinary");
  if (!cloudinaryConnection) {
    console.log('Creating new Cloudinary connection');
    cloudinaryConnection = connectCloudinary();
  }
  return cloudinaryConnection;
};

// Enhanced origin validation function
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin
  
  // Direct whitelist check
  if (whitelist.includes(origin)) return true;
  
  // Pattern matching for dynamic origins
  const patterns = [
    /^https:\/\/(accounts|play)\.google\.com$/,
  ];
  
  return patterns.some(pattern => pattern.test(origin));
};

// Optimized CORS options with better error handling
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`CORS Check - Origin: ${origin || 'no-origin'}`);
    
    if (isOriginAllowed(origin)) {
      console.log(chalk.bgGreen(`Origin allowed: ${origin || 'no-origin'}`));
      return callback(null, true);
    }
    
    console.log(chalk.bgRed(`Origin rejected: ${origin}`));
    callback(new Error(`CORS policy violation: ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'x-user-token', 
    'user-agent',
    'authorization' // Add lowercase version
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 3600 // 1 hour cache
};

// Configure serverless options for optimized performance
const serverlessConfig = {
  binary: ['multipart/form-data'],
  request: {
    maxRequestSize: 100 * 1024 * 1024,
    bodyParserLimit: '100mb'
  }
};

// Initialize Express
const app = express();

// CRITICAL: Handle preflight OPTIONS requests BEFORE applying CORS middleware
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log(`Preflight OPTIONS request from origin: ${origin}`);
  
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-user-token, user-agent, authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '3600');
    res.header('Vary', 'Origin');
    return res.status(204).end();
  }
  
  return res.status(403).json({
    success: false,
    message: 'CORS policy violation',
    origin: origin
  });
});

// Apply CORS middleware
app.use(cors(corsOptions));

// Add explicit CORS headers middleware for all requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-user-token, user-agent, authorization');
    res.header('Vary', 'Origin');
  }
  
  next();
});

// Store origin for consistent behavior throughout request lifecycle
app.use((req, res, next) => {
  req.corsOrigin = req.headers.origin;
  next();
});

// Add request caching middleware for improved performance
const CACHE_DURATION = 60 * 1000; // 1 minute in milliseconds
app.use((req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') return next();
  
  // Don't cache authenticated routes
  if (req.headers.authorization) return next();
  
  const key = `__express__${req.originalUrl || req.url}`;
  const cachedBody = cache.get(key);
  
  if (cachedBody) {
    console.log(`Cache hit for ${req.url}`);
    res.send(cachedBody);
    return;
  }

  const send = res.send;
  
  res.send = function(body) {
    if (res.statusCode === 200) {
      cache.put(key, body, CACHE_DURATION);
    }
    send.call(this, body);
  };
  
  next();
});

// Optimize logging for serverless environment
app.use((req, res, next) => {
  if (!isDevelopment) {
    console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);
    return next();
  }
  
  console.log(chalk.bold.green('\n=== Incoming Request ==='));
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Origin:', req.headers.origin);
  console.log('Authorization:', req.headers.authorization ? 'Present' : 'Not present');
  next();
});

// Custom Modules
const requestLogger = require('../middlewares/requestLogger');

// Load passport configuration
require("../utils/passport");

// Routes
const authRouter = require("../routes/authRoutes");
const userRoutes = require("../routes/userRoutes");
const readingListRoutes = require("../routes/readingListRoutes");
const commentRoutes = require("../routes/commentRoutes");
const seriesRouters = require("../routes/seriesRoutes");

// Configure Express
app.set('trust proxy', true);

// Apply middlewares optimized for serverless
app.use(requestLogger);

// Use compression
app.use(compression({
  level: 6,
  threshold: 0 
}));

// Configure body parser with efficient limits
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

// Performance monitoring middleware with timeout
app.use((req, res, next) => {
  const start = Date.now();
  
  const timeout = setTimeout(() => {
    console.warn(`Request timeout for ${req.method} ${req.url}`);
    
    res.status(408).json({
      success: false,
      message: 'Request timeout - serverless function execution limit reached'
    });
  }, 25 * 60 * 1000);
  
  if ((req.url.includes('/uploadChapter') || req.headers['content-length'] > 10485760)) {
    if (req.socket && typeof req.socket.setTimeout === 'function') {
      req.socket.setTimeout(30 * 60 * 1000);
      console.log(`Extended socket timeout for large upload: ${req.url}`);
    }
  }
  
  res.on('finish', () => {
    clearTimeout(timeout);
    const duration = Date.now() - start;
    if (duration > 10000) {
      console.warn(`Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }
  });

  next();
});

// Session configuration optimized for serverless
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      touchAfter: 24 * 3600,
      autoRemove: 'interval',
      autoRemoveInterval: 120
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Initialize Passport after session middleware
app.use(passport.initialize());
app.use(passport.session());

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Set CORS headers even for errors
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-user-token, user-agent, authorization');
    res.header('Vary', 'Origin');
  }
  
  if (err.name === 'PassportError') {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=Authentication failed`);
  }
  
  if (err.message && err.message.includes('CORS')) {
    console.error('CORS Error:', {
      origin: req.corsOrigin,
      method: req.method,
      path: req.path,
      error: err.message
    });
    
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: err.message,
      origin: req.corsOrigin
    });
  }
  
  if (err instanceof SyntaxError || err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Payload too large or malformed',
      error: err.message
    });
  }
  
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    return res.status(408).json({
      success: false,
      message: 'Request timeout',
      error: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Connect to services
try {
  const { connectDB } = require("../utils/db");
  const connectCloudinary = require("../utils/cloudinary");
  
  connectDB();
  connectCloudinary();
} catch (error) {
  console.error('Failed to connect to services:', error);
}

// Routes
app.get('/api', (req, res) => {
  const filePath = path.join(__dirname, '../dist/index.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Internal Server Error');
    }
  });
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRoutes);
app.use("/api/readingList", readingListRoutes);
app.use("/api/comment", commentRoutes);
app.use("/api/admin", seriesRouters);

// Export the serverless handler
module.exports.handler = serverless(app, serverlessConfig);