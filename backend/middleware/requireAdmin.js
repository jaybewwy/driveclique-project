const User = require('../models/user');
const { asyncHandler, AppError } = require('./errorHandler');

/**
 * Restricts a route to emails listed in ADMIN_EMAILS (comma-separated).
 * Fails closed: an unset/empty ADMIN_EMAILS means the route is never accessible.
 * Must run after `protect` (relies on req.user.id from the JWT).
 */
const requireAdmin = asyncHandler(async (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    throw new AppError('Not authorized to access this resource', 403);
  }

  const user = await User.findById(req.user.id).select('email');
  if (!user || !adminEmails.includes(user.email.toLowerCase())) {
    throw new AppError('Not authorized to access this resource', 403);
  }

  next();
});

module.exports = { requireAdmin };
