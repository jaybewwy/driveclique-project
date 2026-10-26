// Avatar images by URL (audit finding 9). Responses carry the signed URLs
// that utils/imageUrls.js builds; this serves the bytes behind them.

const User = require('../models/user');
const Club = require('../models/club');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { isValidSignature, parseImageData } = require('../utils/imageUrls');

const MODELS = { users: User, clubs: Club };

// Raster images only: an SVG served from the API's origin could carry script
const SERVED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * A user's or club's avatar
 * @route GET /api/images/:kind/:id/avatar?v=&sig=
 * @access A valid signature, not a token: an <img> cannot send one
 */
const getAvatar = asyncHandler(async (req, res) => {
  const { kind, id } = req.params;
  const { v, sig } = req.query;
  if (!MODELS[kind] || !isValidSignature(kind, id, v, sig)) {
    throw new AppError('Image not found', 404);
  }

  const doc = await MODELS[kind].findById(id).select('avatar').lean();
  const image = parseImageData(doc?.avatar);
  if (!image || !SERVED_TYPES.has(image.type)) {
    throw new AppError('Image not found', 404);
  }

  res.set({
    'Content-Type': image.type,
    // `v` changes with the image, so a cached copy never goes stale
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Helmet's default, same-origin, stops the web app (another origin) showing it
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(image.bytes);
});

module.exports = { getAvatar };
