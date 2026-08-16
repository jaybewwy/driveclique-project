// Shared club-role checks (UC-10). Plain functions, not Express middleware —
// this app has no middleware-based role-check layer anywhere; every existing
// leader check is inline in its controller, so this follows that convention
// rather than introducing a new layer.

const isClubLeader = (club, userId) => {
  if (!club?.leader || !userId) return false;
  const leaderId = club.leader._id || club.leader;
  return leaderId.toString() === userId.toString();
};

const isClubCoLeader = (club, userId) => {
  if (!club?.coLeaders || !userId) return false;
  return club.coLeaders.some((id) => {
    const coLeaderId = id._id || id;
    return coLeaderId.toString() === userId.toString();
  });
};

const hasLeaderPrivileges = (club, userId) =>
  isClubLeader(club, userId) || isClubCoLeader(club, userId);

module.exports = { isClubLeader, isClubCoLeader, hasLeaderPrivileges };
