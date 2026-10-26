// What a club read returns, and to whom. Every endpoint that answers with a
// club document passes it through clubForViewer, so the rules live here once.
//
// - No one's email address. No screen shows another user's address, and an
//   address is what turns a member list into a mailing list.
// - The invite code goes to the leader alone, who shares it from the Invite
//   Members panel.
// - The ban list is not part of a club read. The leader's banned-members panel
//   has its own endpoint (GET /api/clubs/:clubId/banned).
// - Join requests go to the leader and co-leaders who review them. Anyone else
//   sees only their own, which is how the club page knows one is pending.
// - Avatars, the club's and each person's, are URLs (utils/imageUrls.js), not
//   the images. A 200-member club's avatars came to 6 MB of base64 on every
//   visit to its page; as URLs they are about 36 KB, and the browser fetches
//   and caches only the ones it shows.

const { CAR_SUMMARY_FIELDS } = require('../models/user');
const { idOf, isClubLeader, hasLeaderPrivileges } = require('./clubPermissions');
const { AVATAR_FIELDS, avatarUrl, withAvatarUrl } = require('./imageUrls');

const fieldsOf = (names) => Object.fromEntries(names.split(' ').map((name) => [name, 1]));

// What a club read may say about a person, wherever it populates one. The
// avatar comes back as its URL.
const USER_SUMMARY_FIELDS = { ...fieldsOf('username name useDisplayName'), ...AVATAR_FIELDS };
// Member lists also name each member's cars, without their photos (UC-53)
const MEMBER_FIELDS = { ...USER_SUMMARY_FIELDS, ...fieldsOf(CAR_SUMMARY_FIELDS) };

// Named, not "everything except": a field added to the Club model stays out
// of every response until it is listed here. `distanceMiles` comes from the
// proximity search (UC-46).
const CLUB_FIELDS = [
  '_id', 'name', 'description', 'location', 'geo', 'maxMembers', 'isPrivate', 'tags', 'avatar',
  'leader', 'members', 'coLeaders', 'announcements', 'createdAt', 'updatedAt', 'distanceMiles',
];

// What to read for a club in a list (the user's clubs, browse): no avatar
// image, and no announcements, which only the club page shows
const CLUB_LIST_FIELDS = {
  ...fieldsOf('name description location geo maxMembers isPrivate tags leader members coLeaders createdAt inviteCode joinRequests'),
  ...AVATAR_FIELDS,
};
// What to read for the club page: the list's fields and its announcements
const CLUB_READ_FIELDS = { ...CLUB_LIST_FIELDS, announcements: 1 };

/**
 * The club as `req`'s signed-in user may see it. `club` is a document or a
 * plain object read with CLUB_LIST_FIELDS, CLUB_READ_FIELDS, or whole.
 */
const clubForViewer = (club, req) => {
  const doc = typeof club.toObject === 'function' ? club.toObject() : club;
  const viewer = req.user.id.toString();
  const person = (ref) => withAvatarUrl(req, ref);

  const view = {};
  for (const field of CLUB_FIELDS) {
    if (doc[field] !== undefined) view[field] = doc[field];
  }
  view.avatar = avatarUrl(req, 'clubs', doc);
  if (view.leader) view.leader = person(view.leader);
  if (view.members) view.members = view.members.map(person);
  if (view.coLeaders) view.coLeaders = view.coLeaders.map(person);
  if (isClubLeader(doc, viewer)) view.inviteCode = doc.inviteCode;

  const requests = (doc.joinRequests || []).map((r) => ({ ...r, user: person(r.user) }));
  view.joinRequests = hasLeaderPrivileges(doc, viewer)
    ? requests
    : requests.filter((r) => r.user && idOf(r.user) === viewer);
  return view;
};

module.exports = { clubForViewer, USER_SUMMARY_FIELDS, MEMBER_FIELDS, CLUB_LIST_FIELDS, CLUB_READ_FIELDS };
