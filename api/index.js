// Vercel serverless function - Express is first-class on Vercel
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS middleware - Handle preflight OPTIONS requests
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://travel-window-frontend.vercel.app',
      'http://localhost:4200',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now - tighten later
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization']
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors());

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - Optimized for serverless (Official Pattern)
// Use global cache to reuse connection across function invocations
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return immediately
  if (cached.conn) {
    return cached.conn;
  }

  // If connection promise exists, wait for it
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI || process.env.travel_window_MONGODB_URI;
    if (!uri) {
      const error = new Error('Missing MongoDB URI (set MONGODB_URI on Vercel)');
      console.error(error.message);
      throw error;
    }

    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false, // Disable mongoose buffering
      serverSelectionTimeoutMS: 10000, // 10 seconds - reasonable for production
      socketTimeoutMS: 45000,
      maxPoolSize: 1, // Single connection for serverless
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    }).catch((error) => {
      console.error('MongoDB connection error:', error);
      cached.promise = null; // Reset on error
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
};

// API info payload - all endpoints
const apiEndpoints = {
  test: 'GET /api/test',
  health: 'GET /api/health',
  auth: {
    login: 'POST /api/auth/login',
    register: 'POST /api/auth/register',
    me: 'GET /api/auth/me'
  },
  users: 'GET/POST/PUT/DELETE /api/users',
  bookings: 'GET/POST/PUT/DELETE /api/bookings',
  suppliers: 'GET/POST/PUT/DELETE /api/suppliers',
  reports: 'GET /api/reports',
  dashboard: 'GET /api/dashboard',
  payments: 'GET/POST /api/payments',
  seed: 'GET/POST /api/seed?secret=SEED_SECRET'
};

// Root route (for /api and /)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Travel Window Backend API',
    status: 'running',
    endpoints: apiEndpoints,
    timestamp: new Date().toISOString()
  });
});
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Travel Window Backend API',
    status: 'running',
    endpoints: apiEndpoints,
    timestamp: new Date().toISOString()
  });
});

// Test route (without DB) - handle both /test and /api/test
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend working', 
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString() 
  });
});
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend working', 
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString() 
  });
});

// Health check (without DB dependency) - handle both /health and /api/health
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    connected: !!cached.conn,
    readyState: mongoose.connection.readyState,
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    connected: !!cached.conn,
    readyState: mongoose.connection.readyState,
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Middleware to ensure DB connection before routes
const ensureDB = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('DB connection error:', error);
    return res.status(503).json({ 
      error: 'Database connection failed', 
      message: error.message,
      hint: 'Check MongoDB Atlas network access and connection string',
      readyState: mongoose.connection.readyState
    });
  }
};

// Routes - use relative paths so Vercel can trace dependencies
app.use('/auth', ensureDB, require('../routes/auth'));
app.use('/users', ensureDB, require('../routes/users'));
app.use('/bookings', ensureDB, require('../routes/bookings'));
app.use('/suppliers', ensureDB, require('../routes/suppliers'));
app.use('/reports', ensureDB, require('../routes/reports'));
app.use('/dashboard', ensureDB, require('../routes/dashboard'));
app.use('/payments', ensureDB, require('../routes/payments'));
app.use('/seed', ensureDB, require('../routes/seed'));

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

// Export app - Vercel handles Express natively
module.exports = app;
