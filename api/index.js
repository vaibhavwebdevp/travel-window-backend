// Vercel serverless function wrapper for Express app
const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// CORS middleware
app.use(cors({
  origin: [
    'https://travel-window-frontend.vercel.app',
    'http://localhost:4200',
    'http://localhost:3000'
  ],
  credentials: true
}));

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - Optimized for serverless
let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  
  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }
  
  const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
  if (!uri) {
    const error = new Error('Missing MongoDB URI (set MONGODB_URI on Vercel)');
    console.error(error.message);
    throw error;
  }
  
  // Create connection promise
  connectionPromise = (async () => {
    try {
      // Close existing connection if any
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      
      // Connect with aggressive timeouts for serverless
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 3000, // 3 seconds - very aggressive
        socketTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        maxPoolSize: 1, // Single connection for serverless
      });
      
      isConnected = true;
      console.log('MongoDB connected successfully');
      connectionPromise = null; // Reset after success
      return;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      isConnected = false;
      connectionPromise = null; // Reset on error
      throw error;
    }
  })();
  
  return connectionPromise;
};

// Root route (for /api)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Travel Window Backend API',
    status: 'running',
    endpoints: {
      test: '/api/test',
      health: '/api/health',
      auth: '/api/auth/login'
    },
    timestamp: new Date().toISOString()
  });
});

// Test route (without DB) - for debugging
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend working', 
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString() 
  });
});

// Health check (without DB dependency)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    connected: isConnected,
    readyState: mongoose.connection.readyState,
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Middleware to ensure DB connection before routes (with aggressive timeout)
const ensureDB = async (req, res, next) => {
  try {
    // Quick check if already connected
    if (mongoose.connection.readyState === 1) {
      return next();
    }
    
    // Try to connect with very aggressive timeout (2 seconds)
    await Promise.race([
      connectDB(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout (2s)')), 2000)
      )
    ]);
    
    next();
  } catch (error) {
    console.error('DB connection error:', error);
    // Return error immediately, don't wait
    return res.status(503).json({ 
      error: 'Database connection failed', 
      message: error.message,
      hint: 'Check MongoDB Atlas network access and connection string',
      readyState: mongoose.connection.readyState
    });
  }
};

// Routes under /api (Vercel auto-detects api/index.js and routes /api/* to it)
// Express receives paths WITHOUT /api prefix, so /api/auth becomes /auth
app.use('/auth', ensureDB, require(path.join(__dirname, '../routes/auth')));
app.use('/users', ensureDB, require(path.join(__dirname, '../routes/users')));
app.use('/bookings', ensureDB, require(path.join(__dirname, '../routes/bookings')));
app.use('/suppliers', ensureDB, require(path.join(__dirname, '../routes/suppliers')));
app.use('/reports', ensureDB, require(path.join(__dirname, '../routes/reports')));
app.use('/dashboard', ensureDB, require(path.join(__dirname, '../routes/dashboard')));
app.use('/payments', ensureDB, require(path.join(__dirname, '../routes/payments')));
app.use('/', ensureDB, require(path.join(__dirname, '../routes/seed')));

// Catch-all route for debugging
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    originalUrl: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Export serverless handler
module.exports = serverless(app);
