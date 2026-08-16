/**
 * Global Error Handler Middleware
 * Centralized error handling for the entire application
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const logger = require('../utils/logger');
const Event = require('../models/event');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  logger.error(err.message, {
    reqId: req.id,
    method: req.method,
    path: req.path,
    status: err.statusCode || 500,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered for ${field}`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map(val => val.message)
      .join(', ');
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired. Please log in again.';
    error = new AppError(message, 401);
  }

  const finalStatus = error.statusCode || 500;

  // Log every authorization denial as a distinct, aggregatable event so a
  // spike on one endpoint (e.g. a frontend regression calling a leader-only
  // route from a member context) is visible on the admin analytics dashboard
  // instead of only existing as an unreviewed line in the request log.
  // Every 403 in this app is thrown from inside an authenticated route
  // (behind the `protect` middleware), so req.user is always present here —
  // the guard below is defensive, not load-bearing.
  if (finalStatus === 403 && req.user?.id) {
    Event.create({
      user: req.user.id,
      type: 'AUTHZ_DENIED',
      path: req.path,
      metadata: { method: req.method, message: error.message, reqId: req.id },
    }).catch((logErr) => logger.error('Failed to log AUTHZ_DENIED event', { err: logErr.message }));
  }

  res.status(finalStatus).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler, AppError };