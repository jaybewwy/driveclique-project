const express = require('express');
const router = express.Router();
const { imageLimiter } = require('../middleware/rateLimiters');
const { validateParams } = require('../middleware/validation');
const { getAvatar } = require('../controllers/imageController');

// No `protect`: an <img> cannot send the access token. Each URL is signed
// instead (utils/imageUrls.js).
router.use(imageLimiter);

/**
 * @route   GET /api/images/:kind/:id/avatar?v=&sig=
 * @desc    A user's or club's avatar image (kind: users or clubs)
 * @access  Signed URL
 */
router.get(
  '/:kind/:id/avatar',
  validateParams({ id: { required: true, objectId: true } }),
  getAvatar
);

module.exports = router;
