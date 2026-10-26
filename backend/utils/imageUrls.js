// Avatars travel in responses as URLs, not base64 (audit finding 9, 2026-10-26).
// A page of clubs carried every club's 60 KB avatar inside its JSON, where no
// browser can cache it. GET /api/images/:kind/:id/avatar serves the bytes with
// a year-long cache, and the URL changes whenever the avatar does (`v`).
//
// An <img> cannot send the access token, so the image route is not behind
// `protect`. Each URL carries a signature instead (`sig`, an HMAC of the kind,
// id, and version): it works for whoever a signed-in response gave it to, and
// cannot be made from an id.
//
// A read that only needs the URL never loads the image: AVATAR_FIELDS asks
// MongoDB whether there is one and for its version.

const crypto = require('crypto');

// A projection for the URL in place of `avatar`. `updatedAt` is the version
// for an avatar saved before `avatarUpdatedAt` existed.
const AVATAR_FIELDS = {
  hasAvatar: { $gt: [{ $strLenBytes: { $ifNull: ['$avatar', ''] } }, 0] },
  avatarUpdatedAt: 1,
  updatedAt: 1,
};

// Derived from JWT_SECRET, so there is no second secret to configure
const signingKey = () => crypto.createHash('sha256').update(`image-urls:${process.env.JWT_SECRET}`).digest();

const signatureFor = (kind, id, version) => crypto
  .createHmac('sha256', signingKey())
  .update(`${kind}/${id}/${version}`)
  .digest('base64url')
  .slice(0, 22);

const isValidSignature = (kind, id, version, sig) => {
  if (typeof version !== 'string' || typeof sig !== 'string') return false;
  const expected = Buffer.from(signatureFor(kind, id, version));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

const versionOf = (doc) => new Date(doc.avatarUpdatedAt || doc.updatedAt || 0).getTime().toString(36);

// The API's own origin as the client reached it (`trust proxy` makes the
// protocol right behind Railway's edge)
const originOf = (req) => `${req.protocol}://${req.get('host')}`;

/**
 * The URL of a user's or club's avatar, or '' when there is none. `doc` has
 * either its `avatar` or AVATAR_FIELDS.
 */
const avatarUrl = (req, kind, doc) => {
  const present = doc.hasAvatar ?? Boolean(doc.avatar);
  if (!present) return '';
  const version = versionOf(doc);
  return `${originOf(req)}/api/images/${kind}/${doc._id}/avatar?v=${version}&sig=${signatureFor(kind, doc._id, version)}`;
};

/**
 * A populated user (plain object) with `avatar` as its URL, without the
 * fields read only to build it. An unpopulated id, or a person read without
 * their avatar, comes back as it is.
 */
const withAvatarUrl = (req, person) => {
  if (!person || person._bsontype === 'ObjectId') return person;
  if (person.hasAvatar === undefined && person.avatar === undefined) return person;
  const { hasAvatar: _has, avatarUpdatedAt: _at, updatedAt: _updated, ...view } = person;
  return { ...view, avatar: avatarUrl(req, 'users', person) };
};

/**
 * A stored avatar's bytes and type, or null for anything but a base64 data
 * URI. Read without a regular expression: the string can be 300,000
 * characters.
 */
const parseImageData = (value) => {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null;
  const comma = value.indexOf(',');
  if (comma < 0) return null;
  const [type, encoding] = value.slice('data:'.length, comma).split(';');
  if (encoding !== 'base64') return null;
  return { type, bytes: Buffer.from(value.slice(comma + 1), 'base64') };
};

// What a write may store as an avatar: an image as a data URI, or '' to
// remove it. Anything else (such as one of these URLs sent back unchanged by
// a form) leaves the stored avatar alone.
const isStorableAvatar = (value) => value === '' || (typeof value === 'string' && value.startsWith('data:image/'));

module.exports = {
  AVATAR_FIELDS,
  avatarUrl,
  withAvatarUrl,
  isValidSignature,
  parseImageData,
  isStorableAvatar,
};
