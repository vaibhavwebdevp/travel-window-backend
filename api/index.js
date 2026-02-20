// Vercel serverless function wrapper for Express app - MINIMAL TEST VERSION
const express = require('express');
const serverless = require('serverless-http');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend working', timestamp: new Date().toISOString() });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Backend working (no /api prefix)', timestamp: new Date().toISOString() });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Export serverless handler
module.exports = serverless(app);
