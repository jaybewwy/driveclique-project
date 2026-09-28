// A user's own profile (incl. My Garage cars, UC-09), user search, other
// users' public profiles (UC-22), and user-to-user blocking (UC-32).

const User = require('../models/user');
const Club = require('../models/club');
const RSVP = require('../models/rsvp');
const { asyncHandler, AppError, orNotFound } = require('../middleware/errorHandler');
const { escapeRegex } = require('../utils/regex');
const { capArray } = require('../utils/arrayCap');

const MAX_CARS = 5;
const MAX_PHOTOS_PER_CAR = 4;

/** Caps car/photo counts and ensures exactly one car is flagged primary (if any exist) */
const normalizeCars = (cars) => {
  // 'start' keeps the first MAX_CARS entries submitted, matching this
  // function's original `cars.slice(0, MAX_CARS)` behavior exactly.
  const trimmed = capArray(cars, MAX_CARS, 'start').map(car => ({
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

/**
 * Get User Profile
 * @route GET /api/auth/profile
 * @access Private
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = orNotFound(await User.findById(req.user.id).select('-password'), 'User not found');

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

  const user = orNotFound(await User.findById(req.user.id), 'User not found');

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

  const users = await User.find({
    username: { $regex: escapeRegex(query.trim()), $options: 'i' }
  })
  .select('-password')
  .limit(10);

  res.json({ success: true, users });
});

/**
 * Get another user's public profile — a safe field subset plus derived
 * context (clubs both users share, "going" RSVP count as a participation
 * signal). Never returns email, password, or tokens.
 * @route   GET /api/auth/users/:userId/public
 * @access  Private
 */
const getPublicProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.user.id;

  const [user, viewer] = await Promise.all([
    User.findById(userId)
      .select('username name firstName lastName avatar bio location cars useDisplayName createdAt blockedUsers')
      .lean(),
    User.findById(viewerId).select('blockedUsers').lean(),
  ]);

  // UC-32 — if the target has blocked the viewer, hide the profile entirely
  // rather than a distinct "you're blocked" error, so a blocked viewer can't
  // tell the difference between a nonexistent user and one who blocked them.
  const viewerIsBlocked = (user?.blockedUsers || []).some((id) => id.toString() === viewerId);
  if (!user || viewerIsBlocked) {
    throw new AppError('User not found', 404);
  }

  const isBlockedByViewer = (viewer?.blockedUsers || []).some((id) => id.toString() === userId);

  const [mutualClubs, goingCount] = await Promise.all([
    Club.find({
      $and: [
        { $or: [{ leader: viewerId }, { members: viewerId }, { coLeaders: viewerId }] },
        { $or: [{ leader: userId }, { members: userId }, { coLeaders: userId }] },
      ],
    }).select('name').lean(),
    RSVP.countDocuments({ user: userId, status: 'going' }),
  ]);

  // blockedUsers was only selected to compute the check above — strip it
  // before spreading `user` into the response so a viewer never sees the
  // target's own block list.
  const { blockedUsers: _omit, ...safeUser } = user;

  res.json({
    success: true,
    profile: {
      ...safeUser,
      mutualClubs: mutualClubs.map((c) => ({ _id: c._id, name: c.name })),
      goingCount,
      isBlockedByViewer,
    },
  });
});

/**
 * Block Another User (UC-32) — one-directional: only affects what the
 * blocked user can do toward the blocker (currently: viewing the blocker's
 * public profile via getPublicProfile above). Deliberately never affects
 * reporting — blocking must not be usable to suppress a legitimate report
 * against you.
 * @route   POST /api/auth/users/:userId/block
 * @access  Private
 */
const blockUser = asyncHandler(async (req, res) => {
  const { userId: targetId } = req.params;
  const viewerId = req.user.id;

  if (targetId === viewerId) {
    throw new AppError('You cannot block yourself.', 400);
  }

  orNotFound(await User.exists({ _id: targetId }), 'User not found');

  await User.updateOne({ _id: viewerId }, { $addToSet: { blockedUsers: targetId } });

  res.json({ success: true, message: 'User blocked.' });
});

/**
 * Unblock a Previously-Blocked User (UC-32)
 * @route   DELETE /api/auth/users/:userId/block
 * @access  Private
 */
const unblockUser = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: req.params.userId } });

  res.json({ success: true, message: 'User unblocked.' });
});

module.exports = {
  getProfile,
  updateProfile,
  searchUsers,
  getPublicProfile,
  blockUser,
  unblockUser,
};
