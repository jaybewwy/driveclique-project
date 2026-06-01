const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authentication');
const { validateInput, validateQuery } = require('../middleware/validation');
const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  searchUsers,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  deleteAccount,
  changeUsername,
} = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const isDev = process.env.NODE_ENV === 'development';

const registerLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 60 * 60 * 1000,   // 1 min in dev, 1 hr in prod
  max: isDev ? 50 : 5,
  message: { success: false, message: 'Too many accounts created from this IP. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

const forgotPasswordLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 60 * 60 * 1000,   // 1 min in dev, 1 hr in prod
  max: isDev ? 10 : 3,
  message: { success: false, message: 'Too many password reset requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

const resendVerificationLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 60 * 60 * 1000,   // 1 min in dev, 1 hr in prod
  max: isDev ? 10 : 3,
  message: { success: false, message: 'Too many verification requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registerLimiter,
  validateInput({
    username: { required: true, type: 'string', minLength: 3, maxLength: 30 },
    email: { required: true, type: 'string', email: true },
    password: { required: true, type: 'string', minLength: 6, maxLength: 100 },
    name: { type: 'string', minLength: 1, maxLength: 100 }
  }),
  registerUser
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  validateInput({
    username: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
  }),
  loginUser
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', protect, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  protect,
  validateInput({
    name: { type: 'string', minLength: 1, maxLength: 100 },
    bio: { type: 'string', minLength: 1, maxLength: 500 },
    avatar: { type: 'string' }, // URL, could add pattern validation
    useDisplayName: { type: 'boolean' },
    car: {
      type: 'object',
      custom: (value) => {
        if (value && typeof value === 'object') {
          if (value.year && (typeof value.year !== 'string' || value.year.length > 4)) {
            return 'Invalid car year';
          }
          if (value.make && (typeof value.make !== 'string' || value.make.length > 50)) {
            return 'Invalid car make';
          }
          if (value.model && (typeof value.model !== 'string' || value.model.length > 50)) {
            return 'Invalid car model';
          }
          if (value.color && (typeof value.color !== 'string' || value.color.length > 30)) {
            return 'Invalid car color';
          }
        }
        return null;
      }
    }
  }),
  updateProfile
);

/**
 * @route   GET /api/auth/users/search
 * @desc    Search users
 * @access  Private
 */
router.get(
  '/users/search',
  protect,
  validateQuery({ query: { maxLength: 100 } }),
  searchUsers
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Exchange a refresh token for a new access token
 * @access  Public
 */
router.post(
  '/refresh',
  validateInput({ refreshToken: { required: true, type: 'string' } }),
  refreshAccessToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke a refresh token
 * @access  Public
 */
router.post('/logout', logoutUser);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validateInput({
    email: { required: true, type: 'string', email: true }
  }),
  forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token from email link
 * @access  Public
 */
router.post(
  '/reset-password',
  validateInput({
    token:    { required: true, type: 'string', minLength: 80, maxLength: 80 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 100 }
  }),
  resetPassword
);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email address using token from email link
 * @access  Public
 */
router.get(
  '/verify-email',
  validateQuery({ token: { required: true, type: 'string', minLength: 80, maxLength: 80 } }),
  verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post(
  '/resend-verification',
  protect,
  resendVerificationLimiter,
  resendVerification
);

/**
 * @route   DELETE /api/auth/account
 * @desc    Permanently delete the authenticated user's account and all associated data
 * @access  Private
 */
router.delete(
  '/account',
  protect,
  validateInput({ password: { required: true, type: 'string', minLength: 1 } }),
  deleteAccount
);

/**
 * @route   PUT /api/auth/username
 * @desc    Change username (enforces 60-day cooldown)
 * @access  Private
 */
router.put(
  '/username',
  protect,
  validateInput({
    username: { required: true, type: 'string', minLength: 3, maxLength: 30 },
  }),
  changeUsername
);

module.exports = router;