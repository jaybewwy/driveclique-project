// Expo push tokens for the mobile app (UC-34), one per device

const User = require('../models/user');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Small-cap convention (see MAX_CARS in userController.js) — bounds
// re-registrations across many devices/reinstalls
const MAX_PUSH_TOKENS = 10;

/**
 * POST /api/auth/push-token — register (or refresh) this device's Expo push token
 * @access Private
 */
const registerPushToken = asyncHandler(async (req, res) => {
  const { expoPushToken, platform } = req.body;

  // A single atomic aggregation-pipeline update, not a findById -> mutate in
  // JS -> save() round trip: the previous version read the whole document,
  // edited pushTokens in memory, then wrote the whole document back — a
  // lost-update race whenever two registrations for the same user land
  // close together (two devices registering at once, or a duplicate/retried
  // request for the very same token), since whichever save() landed second
  // silently overwrote the first's change. This pipeline does everything in
  // one atomic write: if the token is already present, its entry is updated
  // in place (preserving the existing platform when none is supplied —
  // `platform || '$$t.platform'` embeds either the literal new value or a
  // reference back to the current document's own field, matching the
  // original code's "only overwrite platform if truthy" rule exactly);
  // otherwise the token is appended. Either way the array is then capped to
  // the last MAX_PUSH_TOKENS entries.
  const result = await User.updateOne(
    { _id: req.user.id },
    [
      {
        $set: {
          pushTokens: {
            $let: {
              vars: {
                all: { $ifNull: ['$pushTokens', []] },
                hasExisting: { $in: [expoPushToken, { $ifNull: ['$pushTokens.token', []] }] },
              },
              in: {
                $slice: [
                  {
                    $cond: [
                      '$$hasExisting',
                      {
                        $map: {
                          input: '$$all',
                          as: 't',
                          in: {
                            $cond: [
                              { $eq: ['$$t.token', expoPushToken] },
                              { token: '$$t.token', platform: platform || '$$t.platform' },
                              '$$t',
                            ],
                          },
                        },
                      },
                      { $concatArrays: ['$$all', [{ token: expoPushToken, platform: platform || 'unknown' }]] },
                    ],
                  },
                  -MAX_PUSH_TOKENS,
                ],
              },
            },
          },
        },
      },
    ],
    { updatePipeline: true } // required by Mongoose 9.x to accept an array (aggregation pipeline) as the update
  );

  if (result.matchedCount === 0) throw new AppError('User not found', 404);

  res.json({ success: true, message: 'Push token registered.' });
});

/**
 * DELETE /api/auth/push-token — unregister this device's Expo push token (called on logout)
 * @access Private
 */
const unregisterPushToken = asyncHandler(async (req, res) => {
  const { expoPushToken } = req.body;

  await User.updateOne(
    { _id: req.user.id },
    { $pull: { pushTokens: { token: expoPushToken } } }
  );

  res.json({ success: true, message: 'Push token unregistered.' });
});

module.exports = { registerPushToken, unregisterPushToken };
