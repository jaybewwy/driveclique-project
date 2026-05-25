const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db');
const { errorHandler } = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// ============================================
// Middleware
// ============================================

// Enable CORS for all routes (configure as needed for production)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// Routes
// ============================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'DriveClique API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', require('./routes/authentication'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/drives', require('./routes/drives'));

// ============================================
// Error Handling
// ============================================

// 404 Handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found` 
  });
});

// Global error handler middleware
app.use(errorHandler);

// ============================================
// Server
// ============================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║                                          ║
║   DriveClique API Server                 ║
║                                          ║
║   Environment: ${process.env.NODE_ENV || 'development'}${' '.repeat(27 - (process.env.NODE_ENV || 'development').length)}║
║   Port: ${PORT}${' '.repeat(32 - String(PORT).length)}║
║   URL: http://localhost:${PORT}${' '.repeat(17 - String(PORT).length)}║
║                                          ║
╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // In development, we might want to shut down
  if (process.env.NODE_ENV === 'production') {
    server.close(() => process.exit(1));
  }
});

module.exports = app;