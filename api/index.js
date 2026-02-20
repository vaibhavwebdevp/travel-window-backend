// Vercel serverless function wrapper for Express app - MINIMAL TEST VERSION
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

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

// Vercel auto-detects api/index.js and routes /api/* to it
// But Express receives paths WITHOUT /api prefix
// So /api/test becomes /test in Express

// Root route (for /api)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Travel Window Backend API',
    status: 'running',
    endpoints: {
      test: '/api/test',
      health: '/api/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Test route (handles /api/test)
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend working', 
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString() 
  });
});

// Health check (handles /api/health)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    path: req.path,
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

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

// Export serverless handler with timeout configuration
module.exports = serverless(app, {
  binary: ['image/*', 'application/pdf'],
  request: (request, event, context) => {
    // Set timeout to prevent hanging
    request.timeout = 10000; // 10 seconds
  }
});
