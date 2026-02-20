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

// Root route
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

// Simple test route
// Vercel auto-detects /api/index.js and routes /api/* to this function
app.get('/test', (req, res) => {
  res.json({ message: 'Backend working', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend working (with /api prefix)', timestamp: new Date().toISOString() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Export serverless handler
module.exports = serverless(app);
