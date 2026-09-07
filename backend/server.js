const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./db');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Start background scheduler (drive reminder notifications)
require('./services/scheduler').startScheduler();

const app = express();

// ============================================
// Middleware
// ============================================

// Attach a unique request ID to every incoming request for log correlation
app.use((req, _res, next) => {
  req.id = require('crypto').randomUUID();
  next();
});

// Security headers (CSP, X-Frame-Options, etc.)
app.use(helmet());

// HTTP request logging — routed through winston so all logs share one format.
// Custom :safe-url token redacts the `token` query param (the SSE stream
// route authenticates via ?token=<JWT>, since EventSource can't set headers)
// so a live access token is never written into application logs in the clear.
morgan.token('safe-url', (req) => {
  const url = req.originalUrl || req.url;
  return url.replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]');
});
app.use(morgan(':method :safe-url :status :res[content-length]b :response-time ms', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Enable CORS — allow browser clients and Capacitor WebView origins.
// iOS Capacitor uses 'capacitor://localhost'. Android's default androidScheme
// has been 'https' since Capacitor 3, so the WebView's real origin is
// 'https://localhost' — 'http://localhost' is kept too in case androidScheme
// is ever overridden back to 'http' in capacitor.config.ts.
const _allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.ALLOWED_ORIGIN_WEB, 'capacitor://localhost', 'https://localhost', 'http://localhost'].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8081', 'capacitor://localhost', 'https://localhost', 'http://localhost'];

// credentials: true is intentionally omitted — this app authenticates via a
// JWT sent in the Authorization header (services/api.js), never cookies, so
// there's nothing that needs the browser to include ambient credentials.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl, Postman, server-to-server
    if (_allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
}));

// Parse JSON request bodies
app.use(express.json({ limit: '50mb' }));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/events', require('./routes/events'));

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
  logger.info('DriveClique API started', {
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    url: `http://localhost:${PORT}`,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', { message: err.message, stack: err.stack });
  if (process.env.NODE_ENV === 'production') {
    server.close(() => process.exit(1));
  }
});

module.exports = app;