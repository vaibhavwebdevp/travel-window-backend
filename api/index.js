// Vercel serverless function wrapper for Express app
const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://travel-window-frontend.vercel.app', // Frontend URL (update after frontend deploys)
    'http://localhost:4200',
    'http://localhost:3000'
  ],
  credentials: true
}));
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

// Simple test route (without DB) - for debugging
// Note: Vercel sends requests with full path, so /api/test works
app.get('/api/test', (req, res) => {
  res.json({ message: 'API working', timestamp: new Date().toISOString() });
});

app.get('/test', (req, res) => {
  res.json({ message: 'API working (no /api prefix)', timestamp: new Date().toISOString() });
});

// Health check (without DB dependency)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected: isConnected,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected: isConnected,
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

// Routes under /api (Vercel sends /api/... to this function)
app.use('/api/auth', ensureDB, require(path.join(__dirname, '../routes/auth')));
app.use('/api/users', ensureDB, require(path.join(__dirname, '../routes/users')));
app.use('/api/bookings', ensureDB, require(path.join(__dirname, '../routes/bookings')));
app.use('/api/suppliers', ensureDB, require(path.join(__dirname, '../routes/suppliers')));
app.use('/api/reports', ensureDB, require(path.join(__dirname, '../routes/reports')));
app.use('/api/dashboard', ensureDB, require(path.join(__dirname, '../routes/dashboard')));
app.use('/api/payments', ensureDB, require(path.join(__dirname, '../routes/payments')));
app.use('/api', ensureDB, require(path.join(__dirname, '../routes/seed')));

// Export serverless handler
module.exports = serverless(app);
