const crypto = require('crypto');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validateInput, isValidEmail, isValidUsername } = require('../middleware/validation');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Short-lived access token (15 min) */
const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

/** Opaque refresh token stored in DB */
const createRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await RefreshToken.create({ token, user: userId, expiresAt });
  return token;
};

/**
 * POST /api/auth/refresh — Exchange a valid refresh token for a new access token
 * @access Public
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  const stored = await RefreshToken.findOne({ token: refreshToken });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const accessToken = generateAccessToken(stored.user.toString());
  res.json({ success: true, token: accessToken });
});

/**
 * POST /api/auth/logout — Revoke the supplied refresh token
 * @access Public
 */
const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await RefreshToken.findOneAndUpdate({ token: refreshToken }, { revoked: true });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Get User Profile
 * @route GET /api/auth/profile
 * @access Private
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Ensure useDisplayName field exists for backward compatibility
  if (user.useDisplayName === undefined) {
    user.useDisplayName = false;
  }

  res.json({ success: true, user });
});

/**
 * Update User Profile
 * @route PUT /api/auth/profile
 * @access Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, avatar, car, useDisplayName } = req.body;

  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Normalize boolean values (handle string "true"/"false" from some clients)
  const normalizedUseDisplayName =
    typeof useDisplayName === 'string' ? useDisplayName === 'true' : useDisplayName;

  // Update fields only if provided
  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;
  if (useDisplayName !== undefined) user.useDisplayName = normalizedUseDisplayName;
  
  if (car !== undefined) {
    user.car = {
      year: car.year || '',
      make: car.make || '',
      model: car.model || '',
      color: car.color || ''
    };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      car: user.car,
      role: user.role,
      useDisplayName: user.useDisplayName
    }
  });
});

/**
 * Search Users
 * @route GET /api/auth/users/search
 * @access Private
 */
const searchUsers = asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!query || !query.trim()) {
    return res.json({ success: true, users: [] });
  }

  // Escape user input to prevent ReDoS attacks
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const users = await User.find({
    username: { $regex: escapeRegex(query.trim()), $options: 'i' }
  })
  .select('-password')
  .limit(10);

  res.json({ success: true, users });
});

/**
 * Register User
 * @route POST /api/auth/register
 * @access Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, name } = req.body;

  // Check for existing user (email or username)
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new AppError('User with this email or username already exists', 400);
  }

  // Create user
  const user = await User.create({
    username,
    email,
    password,
    name: name || username
  });

  const [token, refreshToken] = await Promise.all([
    Promise.resolve(generateAccessToken(user._id)),
    createRefreshToken(user._id),
  ]);

  res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      useDisplayName: user.useDisplayName
    },
    token,
    refreshToken,
  });
});

/**
 * Login User
 * @route POST /api/auth/login
 * @access Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid username or password', 401);
  }

  const [token, refreshToken] = await Promise.all([
    Promise.resolve(generateAccessToken(user._id)),
    createRefreshToken(user._id),
  ]);

  res.json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      useDisplayName: user.useDisplayName
    },
    token,
    refreshToken,
  });
});

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  searchUsers,
  refreshAccessToken,
  logoutUser,
};