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
} = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many accounts created from this IP. Please try again in an hour.' },
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

module.exports = router;