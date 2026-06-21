const crypto = require('crypto');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const Club = require('../models/club');
const Drive = require('../models/drive');
const RSVP = require('../models/rsvp');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validateInput, isValidEmail, isValidUsername } = require('../middleware/validation');
const { sendEmail, emailTemplates } = require('../services/emailService');
const { verifyEmailAddress } = require('../services/emailVerifier');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PASSWORD_HISTORY_LIMIT = 4; // + current password = last 5 passwords checked for reuse

/** True if plainPassword matches the user's current password or any of their last 4 previous passwords */
const isPasswordReused = async (plainPassword, user) => {
  const hashesToCheck = [user.password, ...(user.passwordHistory || [])];
  for (const hash of hashesToCheck) {
    if (await bcrypt.compare(plainPassword, hash)) return true;
  }
  return false;
};

const MAX_CARS = 5;
const MAX_PHOTOS_PER_CAR = 4;

/** Caps car/photo counts and ensures exactly one car is flagged primary (if any exist) */
const normalizeCars = (cars) => {
  const trimmed = cars.slice(0, MAX_CARS).map(car => ({
    year: car.year || '',
    make: car.make || '',
    model: car.model || '',
    color: car.color || '',
    nickname: car.nickname || '',
    photos: Array.isArray(car.photos) ? car.photos.slice(0, MAX_PHOTOS_PER_CAR) : [],
    isPrimary: !!car.isPrimary
  }));

  const primaryIndex = trimmed.findIndex(car => car.isPrimary);
  return trimmed.map((car, i) => ({
    ...car,
    isPrimary: trimmed.length === 0 ? false : i === (primaryIndex === -1 ? 0 : primaryIndex)
  }));
};

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
  const { name, bio, avatar, cars, useDisplayName, firstName, lastName, location } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Normalize boolean values (handle string "true"/"false" from some clients)
  const normalizedUseDisplayName =
    typeof useDisplayName === 'string' ? useDisplayName === 'true' : useDisplayName;

  // Update fields only if provided
  if (name        !== undefined) user.name      = name;
  if (bio         !== undefined) user.bio       = bio;
  if (avatar      !== undefined) user.avatar    = avatar;
  if (firstName   !== undefined) user.firstName = firstName;
  if (lastName    !== undefined) user.lastName  = lastName;
  if (location    !== undefined) user.location  = location;
  if (useDisplayName !== undefined) user.useDisplayName = normalizedUseDisplayName;

  if (cars !== undefined) {
    if (!Array.isArray(cars)) {
      throw new AppError('cars must be an array', 400);
    }
    user.cars = normalizeCars(cars);
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
      firstName: user.firstName,
      lastName:  user.lastName,
      location:  user.location,
      bio: user.bio,
      avatar: user.avatar,
      cars: user.cars,
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
  const { username, email, password, name, firstName, lastName, location } = req.body;

  // Validate the email address (syntax, domain, MX records, disposable detection)
  const emailCheck = await verifyEmailAddress(email);
  if (!emailCheck.valid) {
    throw new AppError(emailCheck.reason, 400);
  }

  // Check for existing user (email or username)
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new AppError('User with this email or username already exists', 400);
  }

  // Derive display name from firstName + lastName if provided, else fall back to name or username
  const derivedName = [firstName, lastName].filter(Boolean).join(' ') || name || username;

  // Create user — emailVerified skipped for now; a different strategy will be used later
  const user = await User.create({
    username,
    email,
    password,
    name: derivedName,
    firstName: firstName || '',
    lastName:  lastName  || '',
    location:  location  || '',
    emailVerified: true,
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
      firstName: user.firstName,
      lastName:  user.lastName,
      location:  user.location,
      role: user.role,
      useDisplayName: user.useDisplayName,
      emailVerified: user.emailVerified
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
      firstName: user.firstName,
      lastName:  user.lastName,
      location:  user.location,
      role: user.role,
      useDisplayName: user.useDisplayName,
      emailVerified: user.emailVerified
    },
    token,
    refreshToken,
  });
});

/**
 * POST /api/auth/forgot-password — Send a password reset link to the user's email
 * @access Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const genericResponse = () =>
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return genericResponse();

  const rawToken = crypto.randomBytes(40).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  const { subject, html } = emailTemplates.passwordReset({ resetUrl, username: user.username });
  sendEmail({ to: user.email, subject, html }); // fire-and-forget

  return genericResponse();
});

/**
 * POST /api/auth/reset-password — Reset the password using a valid token
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) throw new AppError('Password reset token is invalid or has expired', 400);

  if (await isPasswordReused(password, user)) {
    throw new AppError('You cannot reuse one of your last 5 passwords. Please choose a different password.', 400);
  }

  user.passwordHistory = [user.password, ...(user.passwordHistory || [])].slice(0, PASSWORD_HISTORY_LIMIT);
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successful. You can now sign in.' });
});

/**
 * GET /api/auth/verify-email?token= — Mark email as verified using token from email link
 * @access Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailVerifyToken: hashedToken,
    emailVerifyExpiry: { $gt: new Date() },
  });

  if (!user) throw new AppError('Verification link is invalid or has expired', 400);

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpiry = undefined;
  await user.save();

  res.json({ success: true, message: 'Email verified successfully!' });
});

/**
 * POST /api/auth/resend-verification — Send a fresh verification email
 * @access Private
 */
const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Your email is already verified.' });
  }

  const rawToken = crypto.randomBytes(40).toString('hex');
  user.emailVerifyToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;
  const { subject, html } = emailTemplates.emailVerification({ verifyUrl, username: user.username });
  sendEmail({ to: user.email, subject, html }); // fire-and-forget

  res.json({ success: true, message: 'Verification email sent!' });
});

/**
 * DELETE /api/auth/account — Permanently delete the authenticated user's account
 * @access Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { password } = req.body;

  if (!userId) throw new AppError('Authentication required', 401);

  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) throw new AppError('Incorrect password. Account not deleted.', 401);

  // Block deletion if the user leads any club that still has other members
  const ledClubs = await Club.find({ leader: userId }).select('name members');
  const blockedClubs = ledClubs.filter(c => c.members.length > 1);
  if (blockedClubs.length > 0) {
    const names = blockedClubs.map(c => `"${c.name}"`).join(', ');
    throw new AppError(
      `Transfer leadership or delete these clubs before deleting your account: ${names}`,
      400
    );
  }

  // Clubs the user leads alone — cascade-delete them
  const soloClubIds = ledClubs.filter(c => c.members.length <= 1).map(c => c._id);
  if (soloClubIds.length > 0) {
    const solodriveIds = await Drive.find({ club: { $in: soloClubIds } }).select('_id').lean();
    if (solodriveIds.length > 0) {
      await RSVP.deleteMany({ drive: { $in: solodriveIds.map(d => d._id) } });
    }
    await Drive.deleteMany({ club: { $in: soloClubIds } });
    await Club.deleteMany({ _id: { $in: soloClubIds } });
  }

  // Remove user from all other clubs' member arrays and pending join requests
  await Club.updateMany(
    { $or: [{ members: userId }, { 'joinRequests.user': userId }] },
    { $pull: { members: userId, joinRequests: { user: userId } } }
  );

  // Delete all personal RSVPs, refresh tokens, and the user document
  await RSVP.deleteMany({ user: userId });
  await RefreshToken.deleteMany({ user: userId });
  await User.findByIdAndDelete(userId);

  res.json({ success: true, message: 'Account deleted successfully' });
});

/**
 * PUT /api/auth/password — Change password while logged in
 * @access Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw new AppError('Current password is incorrect.', 401);

  if (await isPasswordReused(newPassword, user)) {
    throw new AppError('You cannot reuse one of your last 5 passwords. Please choose a different password.', 400);
  }

  user.passwordHistory = [user.password, ...(user.passwordHistory || [])].slice(0, PASSWORD_HISTORY_LIMIT);
  user.password = newPassword;
  await user.save(); // pre-save hook re-hashes when password is modified

  res.json({ success: true, message: 'Password updated successfully.' });
});

/**
 * PUT /api/auth/username — Change username (once per 60 days)
 * @access Private
 */
const changeUsername = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  // Enforce 60-day cooldown
  if (user.usernameChangedAt) {
    const msSince = Date.now() - new Date(user.usernameChangedAt).getTime();
    const daysSince = msSince / (1000 * 60 * 60 * 24);
    if (daysSince < 60) {
      const daysLeft = Math.ceil(60 - daysSince);
      throw new AppError(
        `You can change your username again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
        400
      );
    }
  }

  if (!isValidUsername(username)) {
    throw new AppError('Username must be 3–30 characters: letters, numbers, and underscores only.', 400);
  }

  const taken = await User.findOne({ username: username.toLowerCase(), _id: { $ne: user._id } });
  if (taken) throw new AppError('That username is already taken.', 400);

  user.username = username.toLowerCase();
  user.usernameChangedAt = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Username updated successfully.',
    user: {
      _id: user._id,
      username: user.username,
      usernameChangedAt: user.usernameChangedAt,
    },
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
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  deleteAccount,
  changeUsername,
  changePassword,
};