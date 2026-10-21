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

const { CAR_SUMMARY_FIELDS } = require('../models/user');
const { idOf, isClubLeader, hasLeaderPrivileges } = require('./clubPermissions');

// What a club read may say about a person, wherever it populates one
const USER_SUMMARY_FIELDS = 'username avatar name useDisplayName';
// Member lists also name each member's cars, without their photos (UC-53)
const MEMBER_FIELDS = `${USER_SUMMARY_FIELDS} ${CAR_SUMMARY_FIELDS}`;

// Named, not "everything except": a field added to the Club model stays out
// of every response until it is listed here. `distanceMiles` comes from the
// proximity search (UC-46).
const CLUB_FIELDS = [
  '_id', 'name', 'description', 'location', 'geo', 'maxMembers', 'isPrivate', 'tags', 'avatar',
  'leader', 'members', 'coLeaders', 'announcements', 'createdAt', 'updatedAt', 'distanceMiles',
];

const clubForViewer = (club, viewerId) => {
  const doc = typeof club.toObject === 'function' ? club.toObject() : club;
  const viewer = viewerId.toString();

  const view = {};
  for (const field of CLUB_FIELDS) {
    if (doc[field] !== undefined) view[field] = doc[field];
  }
  if (isClubLeader(doc, viewer)) view.inviteCode = doc.inviteCode;

  const requests = doc.joinRequests || [];
  view.joinRequests = hasLeaderPrivileges(doc, viewer)
    ? requests
    : requests.filter((r) => r.user && idOf(r.user) === viewer);
  return view;
};

module.exports = { clubForViewer, USER_SUMMARY_FIELDS, MEMBER_FIELDS };
