// Authentication and account security: register/login, access + refresh
// tokens, password reset/change, email verification and email change,
// username change, and account deletion. Profile data lives in
// userController; mobile push tokens in pushTokenController.

const crypto = require('crypto');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const DriveRating = require('../models/driveRating');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { isValidUsername } = require('../middleware/validation');
const { sendEmail, emailTemplates } = require('../services/emailService');
const { verifyEmailAddress } = require('../services/emailVerifier');
const { deleteClubsCascade } = require('../services/clubCascade');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PASSWORD_HISTORY_LIMIT = 4; // + current password = last 5 passwords checked for reuse
const PASSWORD_REUSED_MESSAGE = 'You cannot reuse one of your last 5 passwords. Please choose a different password.';
const USERNAME_COOLDOWN_DAYS = 60;

/** Frontend base URL used to build emailed confirmation/reset links */
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/** Shared 24-hour expiry window for email-verification and email-change confirmation links (forgotPassword's reset-token window is deliberately shorter — 1 hour — and is not part of this shared constant) */
const TOKEN_TTL_24H = 24 * 60 * 60 * 1000;

/** True if plainPassword matches the user's current password or any of their last 4 previous passwords */
const isPasswordReused = async (plainPassword, user) => {
  const hashesToCheck = [user.password, ...(user.passwordHistory || [])];
  for (const hash of hashesToCheck) {
    if (await bcrypt.compare(plainPassword, hash)) return true;
  }
  return false;
};

/**
 * Swap in a new password (re-hashed by the model's pre-save hook), keeping
 * the old one in the reuse history. Also clears push tokens: a lost or
 * stolen device's push token is still a live channel to this account even
 * after the password that compromised it is gone, the same reason callers
 * revoke refresh tokens afterwards.
 */
const rotatePassword = (user, newPassword) => {
  user.passwordHistory = [user.password, ...(user.passwordHistory || [])].slice(0, PASSWORD_HISTORY_LIMIT);
  user.password = newPassword;
  user.pushTokens = [];
};

/** SHA-256 hex digest — used to store secure random tokens (refresh/reset/verify) at rest without keeping the raw, directly-usable value in the DB */
const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

/** Cryptographically secure random raw token — the single-use value sent to the client (email link or response body) before being hashed for storage via hashToken() */
const generateRawToken = () => crypto.randomBytes(40).toString('hex');

/** Short-lived access token (15 min) */
const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

/**
 * Opaque refresh token. Only the SHA-256 hash is persisted — same treatment as
 * password-reset/email-verify tokens below — so a database read alone (backup
 * leak, injection, insider access) can't be turned directly into a usable
 * session; the raw value only ever exists in the response body and the client.
 */
const createRefreshToken = async (userId) => {
  const token = generateRawToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await RefreshToken.create({ token: hashToken(token), user: userId, expiresAt });
  return token;
};

/** A fresh access + refresh token pair for a newly signed-in user */
const issueSession = async (userId) => ({
  token: generateAccessToken(userId),
  refreshToken: await createRefreshToken(userId),
});

/** The user fields returned by register and login */
const toSessionUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  name: user.name,
  firstName: user.firstName,
  lastName:  user.lastName,
  location:  user.location,
  role: user.role,
  useDisplayName: user.useDisplayName,
  theme: user.theme,
  emailVerified: user.emailVerified
});

/**
 * POST /api/auth/refresh — Exchange a valid refresh token for a new access token
 * @access Public
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  const stored = await RefreshToken.findOne({ token: hashToken(refreshToken) });
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
    await RefreshToken.findOneAndUpdate({ token: hashToken(refreshToken) }, { revoked: true });
  }
  res.json({ success: true, message: 'Logged out successfully' });
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

  res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    user: toSessionUser(user),
    ...await issueSession(user._id),
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

  res.json({
    success: true,
    user: toSessionUser(user),
    ...await issueSession(user._id),
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

  const rawToken = generateRawToken();

  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour — intentionally shorter than TOKEN_TTL_24H, not a duplicate of it
  await user.save();

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

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

  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) throw new AppError('Password reset token is invalid or has expired', 400);

  if (await isPasswordReused(password, user)) {
    throw new AppError(PASSWORD_REUSED_MESSAGE, 400);
  }

  rotatePassword(user, password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // A password reset means any previously-issued session (including one held
  // by an attacker who had the old password) should not survive it.
  await RefreshToken.deleteMany({ user: user._id });

  res.json({ success: true, message: 'Password reset successful. You can now sign in.' });
});

/**
 * PUT /api/auth/password — Change password while logged in
 * @access Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = orNotFound(await User.findById(req.user.id), 'User not found');

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw new AppError('Current password is incorrect.', 401);

  if (await isPasswordReused(newPassword, user)) {
    throw new AppError(PASSWORD_REUSED_MESSAGE, 400);
  }

  rotatePassword(user, newPassword);
  await user.save();

  // Revoke every outstanding session (this one included) so a stolen refresh
  // token can't outlive an intentional password change. The frontend logs
  // the user out immediately on success rather than waiting for their next
  // access-token refresh to fail.
  await RefreshToken.deleteMany({ user: user._id });

  res.json({ success: true, message: 'Password updated successfully. Please sign in again.' });
});

/**
 * GET /api/auth/verify-email?token= — Mark email as verified using token from email link
 * @access Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  const user = await User.findOne({
    emailVerifyToken: hashToken(token),
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
  const user = orNotFound(await User.findById(req.user.id), 'User not found');

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Your email is already verified.' });
  }

  const rawToken = generateRawToken();
  user.emailVerifyToken = hashToken(rawToken);
  user.emailVerifyExpiry = new Date(Date.now() + TOKEN_TTL_24H);
  await user.save();

  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${rawToken}`;
  const { subject, html } = emailTemplates.emailVerification({ verifyUrl, username: user.username });
  sendEmail({ to: user.email, subject, html }); // fire-and-forget

  res.json({ success: true, message: 'Verification email sent!' });
});

/**
 * PUT /api/auth/username — Change username (once per 60 days)
 * @access Private
 */
const changeUsername = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = orNotFound(await User.findById(req.user.id), 'User not found');

  if (user.usernameChangedAt) {
    const msSince = Date.now() - new Date(user.usernameChangedAt).getTime();
    const daysSince = msSince / (1000 * 60 * 60 * 24);
    if (daysSince < USERNAME_COOLDOWN_DAYS) {
      const daysLeft = Math.ceil(USERNAME_COOLDOWN_DAYS - daysSince);
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

/**
 * POST /api/auth/email-change — request changing the account's email address.
 * Sends a confirmation link to the NEW address; the current email keeps
 * working for login until that link is clicked.
 * @access Private
 */
const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;
  const normalizedEmail = newEmail.toLowerCase();

  const user = orNotFound(await User.findById(req.user.id), 'User not found');

  if (normalizedEmail === user.email) {
    throw new AppError('That is already your current email address.', 400);
  }

  const taken = await User.findOne({ email: normalizedEmail });
  if (taken) throw new AppError('That email is already registered.', 400);

  const verifyResult = await verifyEmailAddress(normalizedEmail);
  if (!verifyResult.valid) {
    throw new AppError(verifyResult.reason || 'That email address could not be verified.', 400);
  }

  const rawToken = generateRawToken();
  user.pendingEmail = normalizedEmail;
  user.emailChangeToken = hashToken(rawToken);
  user.emailChangeExpires = new Date(Date.now() + TOKEN_TTL_24H);
  await user.save();

  const confirmUrl = `${FRONTEND_URL}/confirm-email-change?token=${rawToken}`;
  const { subject, html } = emailTemplates.emailChangeVerification({
    confirmUrl,
    username: user.username,
    newEmail: normalizedEmail,
  });
  sendEmail({ to: normalizedEmail, subject, html }); // fire-and-forget, sent to the NEW address — proves the user actually controls it

  res.json({
    success: true,
    message: `Verification link sent to ${normalizedEmail}. Click it to complete the change.`,
  });
});

/**
 * GET /api/auth/email-change/confirm?token= — complete a pending email change
 * @access Public (the token itself proves identity, same pattern as verifyEmail/resetPassword)
 */
const confirmEmailChange = asyncHandler(async (req, res) => {
  const { token } = req.query;

  const user = await User.findOne({
    emailChangeToken: hashToken(token),
    emailChangeExpires: { $gt: new Date() },
  });

  if (!user) throw new AppError('This email change link is invalid or has expired.', 400);

  // The requested address may have been taken by someone else in the window
  // since it was requested (up to 24h) — re-check rather than letting the
  // schema's unique-index violation surface as a raw duplicate-key error.
  const stillAvailable = await User.findOne({ email: user.pendingEmail, _id: { $ne: user._id } });
  if (stillAvailable) throw new AppError('That email is already registered to another account.', 400);

  const oldEmail = user.email;
  const newEmail = user.pendingEmail;

  user.email = newEmail;
  user.emailVerified = true;
  user.pendingEmail = undefined;
  user.emailChangeToken = undefined;
  user.emailChangeExpires = undefined;
  await user.save();

  // Best-effort heads-up to the OLD address — the standard mitigation against
  // a hijacked session silently changing the account's email as the first
  // step of a takeover (the same risk class changePassword's session
  // revocation guards against, just via notification here instead).
  const { subject, html } = emailTemplates.emailChangedNotice({ username: user.username, newEmail });
  sendEmail({ to: oldEmail, subject, html });

  res.json({ success: true, message: `Email updated to ${newEmail}.`, email: newEmail });
});

/**
 * DELETE /api/auth/account — Permanently delete the authenticated user's account
 * @access Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body;

  const user = orNotFound(await User.findById(userId).select('+password'), 'User not found');

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) throw new AppError('Incorrect password. Account not deleted.', 401);

  // Block deletion if the user leads any club that still has other members
  const ledClubs = await Club.find({ leader: userId }).select('name members');
  const clubsWithOthers = ledClubs.filter(c => c.members.length > 1);
  if (clubsWithOthers.length > 0) {
    const names = clubsWithOthers.map(c => `"${c.name}"`).join(', ');
    throw new AppError(
      `Transfer leadership or delete these clubs before deleting your account: ${names}`,
      400
    );
  }

  // Clubs the user leads alone go with them
  await deleteClubsCascade(ledClubs.map(c => c._id));

  // Remove user from all other clubs' members, co-leaders, and pending join requests
  await Club.updateMany(
    { $or: [{ members: userId }, { coLeaders: userId }, { 'joinRequests.user': userId }] },
    { $pull: { members: userId, coLeaders: userId, joinRequests: { user: userId } } }
  );

  // Delete all personal RSVPs, ratings, refresh tokens, and the user document
  await RSVP.deleteMany({ user: userId });
  await DriveRating.deleteMany({ user: userId });
  await RefreshToken.deleteMany({ user: userId });
  await User.findByIdAndDelete(userId);

  res.json({ success: true, message: 'Account deleted successfully' });
});

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
  changeUsername,
  requestEmailChange,
  confirmEmailChange,
  deleteAccount,
};
