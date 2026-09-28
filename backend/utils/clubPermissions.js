// Shared club-role checks (UC-10). Plain functions, not Express middleware —
// this app has no middleware-based role-check layer anywhere; every existing
// leader check is inline in its controller, so this follows that convention
// rather than introducing a new layer.

const Club = require('../models/club');
const { AppError, orNotFound } = require('../middleware/errorHandler');

// A club's leader/coLeaders/members may be raw ObjectIds or populated users
const idOf = (ref) => (ref?._id || ref).toString();

const isClubLeader = (club, userId) => {
  if (!club?.leader || !userId) return false;
  return idOf(club.leader) === userId.toString();
};

const isClubCoLeader = (club, userId) => {
  if (!club?.coLeaders || !userId) return false;
  return club.coLeaders.some((id) => idOf(id) === userId.toString());
};

const hasLeaderPrivileges = (club, userId) =>
  isClubLeader(club, userId) || isClubCoLeader(club, userId);

const isClubMember = (club, userId) => {
  if (!club?.members || !userId) return false;
  return club.members.some((id) => idOf(id) === userId.toString());
};

/**
 * Load a club and require the user to be one of its members, throwing
 * 404/403 AppErrors otherwise. `fields` is the projection; it must include
 * `members`.
 */
const findClubAsMember = async (clubId, userId, forbiddenMessage, fields = 'members') => {
  const club = orNotFound(await Club.findById(clubId).select(fields), 'Club not found');
  if (!isClubMember(club, userId)) {
    throw new AppError(forbiddenMessage, 403);
  }
  return club;
};

module.exports = {
  isClubLeader,
  isClubCoLeader,
  hasLeaderPrivileges,
  isClubMember,
  findClubAsMember,
};
