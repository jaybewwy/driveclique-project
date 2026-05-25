const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validateInput, isValidEmail, isValidUsername } = require('../middleware/validation');

/**
 * Generate JWT token for authenticated user
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

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
  
  if (!query) {
    return res.json({ success: true, users: [] });
  }

  const users = await User.find({
    username: { $regex: query, $options: 'i' }
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
    token: generateToken(user._id)
  });
});

/**
 * Login User
 * @route POST /api/auth/login
 * @access Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Find user by username
  const user = await User.findOne({ username });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid username or password', 401);
  }

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
    token: generateToken(user._id)
  });
});

module.exports = { 
  registerUser, 
  loginUser, 
  getProfile, 
  updateProfile, 
  searchUsers 
};