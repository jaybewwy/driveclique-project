import { idOf } from './userDisplay';

/**
 * The viewer's relationship to a club, derived from the club document and
 * the logged-in user. `club.leader`/`members`/`coLeaders` may be populated
 * users or bare ids.
 */
export const getClubRole = (club, user) => {
  const userId = user?._id?.toString() || user?.id?.toString() || '';
  const leaderId = idOf(club?.leader);
  const isLeader = Boolean(leaderId && userId && leaderId === userId);
  const isMember = club?.members?.some((m) => idOf(m) === userId) ?? false;
  const hasPendingRequest = club?.joinRequests?.some(
    (r) => r.user?.toString() === userId && r.status === 'pending'
  ) ?? false;
  // Co-leader is a moderator-tier role (UC-10) — a subset of leader powers
  const isCoLeader = club?.coLeaders?.some((m) => idOf(m) === userId) ?? false;
  const canModerate = isLeader || isCoLeader;

  const isCoLeaderId = (targetUserId) =>
    (club?.coLeaders || []).some((c) => idOf(c) === targetUserId?.toString());

  // UC-22 — same eligibility rule as the member list's own Remove button
  // (leader-or-co-leader, and a co-leader can't remove another co-leader),
  // shared so the drive attendee list can offer the same action.
  const canRemoveMember = (targetUserId) => {
    if (!canModerate) return false;
    return isLeader || !isCoLeaderId(targetUserId);
  };

  return {
    userId,
    isLeader,
    isCoLeader,
    isMember,
    canModerate,
    hasPendingRequest,
    // Members and the leader can open drive details; visitors only browse
    canViewDrives: isMember || isLeader,
    isCoLeaderId,
    canRemoveMember,
  };
};
