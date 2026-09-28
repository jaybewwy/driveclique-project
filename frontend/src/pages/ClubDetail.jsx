import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, X, Plus, Edit3 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import ReportModal from "../components/ui/ReportModal";
import AnnouncementsSection from "../components/ui/AnnouncementsSection";
import ScheduleDriveModal from "../components/ui/ScheduleDriveModal";
import DriveDetailModal from "../components/ui/DriveDetailModal";
import EditDriveModal from "../components/ui/EditDriveModal";
import MemberProfilePanel from "../components/ui/MemberProfilePanel";
import BannedMembersPanel from "../components/ui/BannedMembersPanel";
import { MobileDrawerButton } from "../components/ui/MobileDrawer";
import { ClubHero, ClubNotFound } from "../components/club/ClubHeader";
import PendingJoinRequests from "../components/club/PendingJoinRequests";
import NextDriveCard from "../components/club/NextDriveCard";
import ClubDrivesPanel from "../components/club/ClubDrivesPanel";
import JoinClubPanel from "../components/club/JoinClubPanel";
import InviteMembersPanel from "../components/club/InviteMembersPanel";
import { DriveListModal } from "../components/club/DriveListModal";
import { MembersModal } from "../components/club/MembersModal";
import ClubEditModal from "../components/club/ClubEditModal";
import {
  CancelDriveDialog,
  DeleteClubDialog,
  DeleteDriveDialog,
  LeaveClubDialog,
  RemoveMemberDialog,
} from "../components/club/ClubConfirmDialogs";
import { clubsAPI, drivesAPI } from "../services/api";
import { useClubs } from "../hooks/useClubs";
import { useDriveDetail } from "../hooks/useDriveDetail";
import { useDriveRsvpCounts } from "../hooks/useDriveRsvpCounts";
import { usePageOverlays } from "../hooks/usePageOverlays";
import { getClubRole } from "../lib/clubRole";
import { displayName } from "../lib/userDisplay";
import { compareDriveStart, hasDriveStarted } from "../lib/dateUtils";

const ClubDetail = ({ user, onLogout }) => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { removeClub, updateClub } = useClubs();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clubNotFound, setClubNotFound] = useState(false);
  const [isBlockedByViewer, setIsBlockedByViewer] = useState(false);
  const [drives, setDrives] = useState([]);
  // Seeded by the club fetch; the form/posting UI lives in AnnouncementsSection
  const [announcements, setAnnouncements] = useState([]);

  const [driveRsvpCounts, setDriveRsvpCounts] = useDriveRsvpCounts(drives);
  const driveDetail = useDriveDetail({
    onRsvpCounts: setDriveRsvpCounts,
    // Keep the page's copy in step so the change survives closing the modal
    onPhotosChanged: (driveId, photos) =>
      setDrives((prev) => prev.map((d) => (d._id === driveId ? { ...d, photos } : d))),
  });

  // Overlays. Each dialog owns its own form state; these only say which is open.
  const [driveBeingEdited, setDriveBeingEdited] = useState(null);
  const [showScheduleDriveModal, setShowScheduleDriveModal] = useState(false);
  const [showAllDrivesModal, setShowAllDrivesModal] = useState(false);
  const [showPastEventsModal, setShowPastEventsModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showClubEditModal, setShowClubEditModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [driveToDelete, setDriveToDelete] = useState(null);
  const [driveToCancel, setDriveToCancel] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null); // { id, username }
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  // Self-contained panels (they handle their own focus and Escape)
  const [showBannedMembers, setShowBannedMembers] = useState(false); // UC-32
  // UC-22 — { userId, canRemove } | null. canRemove is decided at click time
  // by the list the member was picked from.
  const [profilePanelTarget, setProfilePanelTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null); // { type, id, name }

  const [coLeaderActionError, setCoLeaderActionError] = useState('');

  usePageOverlays([
    [driveDetail.isOpen, driveDetail.close],
    [Boolean(driveBeingEdited), () => setDriveBeingEdited(null)],
    [showScheduleDriveModal, () => setShowScheduleDriveModal(false)],
    [showAllDrivesModal, () => setShowAllDrivesModal(false)],
    [showPastEventsModal, () => setShowPastEventsModal(false)],
    [showMembersModal, () => setShowMembersModal(false)],
    [showClubEditModal, () => setShowClubEditModal(false)],
    [showLeaveConfirm, () => setShowLeaveConfirm(false)],
    [showDeleteConfirm, () => setShowDeleteConfirm(false)],
    [Boolean(driveToDelete), () => setDriveToDelete(null)],
    [Boolean(memberToRemove), () => setMemberToRemove(null)],
    [Boolean(driveToCancel), () => setDriveToCancel(null)],
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clubResponse, drivesResponse] = await Promise.all([
          clubsAPI.getClubById(clubId),
          drivesAPI.getClubDrives(clubId),
        ]);
        if (clubResponse.data?.success) {
          setClub(clubResponse.data.club);
          setAnnouncements((clubResponse.data.club.announcements || []).slice().reverse());
          setIsBlockedByViewer(Boolean(clubResponse.data.isBlockedByViewer));
        }
        if (drivesResponse.data?.success) setDrives(drivesResponse.data.drives || []);
      } catch (error) {
        const status = error?.response?.status;
        if (status === 404 || status === 400) {
          setClubNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clubId]);

  const role = getClubRole(club, user);
  const pendingJoinRequests = (club?.joinRequests || []).filter((r) => r.status === 'pending');

  const upcomingDrives = drives
    .filter((drive) => !drive.isCancelled && !drive.isCompleted && !hasDriveStarted(drive))
    .sort(compareDriveStart);

  const pastDrives = drives
    .filter((drive) => drive.isCompleted || hasDriveStarted(drive))
    .filter((drive) => !drive.isCancelled)
    .sort((a, b) => compareDriveStart(b, a));

  const refreshClub = async () => {
    const refreshed = await clubsAPI.getClubById(clubId);
    if (refreshed.data?.success) setClub(refreshed.data.club);
  };

  const refreshDrives = async () => {
    const drivesResponse = await drivesAPI.getClubDrives(clubId);
    if (drivesResponse.data?.success) setDrives(drivesResponse.data.drives || []);
  };

  const replaceDrive = (updatedDrive) =>
    setDrives((prev) => prev.map((d) => (d._id === updatedDrive._id ? updatedDrive : d)));

  const openProfile = (targetUserId) => setProfilePanelTarget({
    userId: targetUserId,
    canRemove: role.canRemoveMember(targetUserId),
  });

  /* ── Drive actions ──────────────────────────────────────────────────── */

  const handleMarkComplete = async (drive) => {
    try {
      const response = await drivesAPI.update(drive._id, { isCompleted: true });
      if (response.data?.success) replaceDrive(response.data.drive);
    } catch (error) {
      console.error("Error marking drive as complete:", error);
    }
  };

  const confirmDeleteDrive = async () => {
    try {
      const response = await drivesAPI.delete(driveToDelete._id);
      if (response.data?.success) {
        setDrives((prev) => prev.filter((d) => d._id !== driveToDelete._id));
      }
    } catch (error) {
      console.error("Error deleting drive:", error);
    } finally {
      setDriveToDelete(null);
    }
  };

  // Cancel Drive (UC-10) — distinct from Delete: sets isCancelled + notifies
  // members via SSE/email rather than removing the drive. Errors propagate
  // to CancelDriveDialog, which shows them.
  const confirmCancelDrive = async (reason, cancelWholeSeries) => {
    const response = await drivesAPI.cancel(driveToCancel._id, reason);
    if (!response.data?.success) return;

    const groupId = driveToCancel.recurrence?.groupId;
    // Series cancel runs after the single cancel above, so it only affects
    // the *other* still-upcoming, not-yet-cancelled occurrences — it's
    // leader-only (stricter than single cancel, which co-leaders can also
    // do for drives they created), so only offered to a leader.
    if (cancelWholeSeries && groupId) {
      await drivesAPI.cancelSeries(groupId, reason);
      const now = new Date();
      setDrives((prev) => prev.map((d) =>
        d._id === driveToCancel._id || (d.recurrence?.groupId === groupId && !d.isCancelled && !hasDriveStarted(d, now))
          ? { ...d, isCancelled: true }
          : d
      ));
    } else {
      setDrives((prev) => prev.map((d) => (d._id === driveToCancel._id ? { ...d, isCancelled: true } : d)));
    }
    setDriveToCancel(null);
  };

  // EditDriveModal saves the drive itself and hands back the updated copy
  const handleDriveUpdated = (updatedDrive) => {
    replaceDrive(updatedDrive);
    setDriveBeingEdited(null);
  };

  // ScheduleDriveModal creates the drive(s); refetch so every new
  // occurrence of a recurring series shows up
  const handleDriveScheduled = async () => {
    await refreshDrives();
    setShowScheduleDriveModal(false);
  };

  /* ── Member actions ─────────────────────────────────────────────────── */

  const requestRemoveMember = (memberId, username) => setMemberToRemove({ id: memberId, username });

  // Errors propagate to RemoveMemberDialog, which shows them
  const confirmRemoveMember = async (ban) => {
    const response = await clubsAPI.removeMember(clubId, memberToRemove.id, ban);
    if (response.data?.success) {
      setClub((prevClub) => ({
        ...prevClub,
        members: prevClub.members.filter((m) => m._id !== memberToRemove.id)
      }));
      setMemberToRemove(null);
    }
  };

  // Promote a regular member to co-leader (UC-10) — leader only
  const handlePromoteCoLeader = async (memberId) => {
    setCoLeaderActionError('');
    try {
      const response = await clubsAPI.promoteCoLeader(clubId, memberId);
      if (response.data?.success) {
        const promotedMember = club.members.find((m) => (m._id?.toString() || m?.toString()) === memberId);
        setClub((prevClub) => ({
          ...prevClub,
          coLeaders: [...(prevClub.coLeaders || []), promotedMember || memberId]
        }));
      }
    } catch (error) {
      setCoLeaderActionError(error.response?.data?.message || 'Failed to promote member');
    }
  };

  // Demote a co-leader back to a regular member (UC-10) — leader only
  const handleDemoteCoLeader = async (memberId) => {
    setCoLeaderActionError('');
    try {
      const response = await clubsAPI.demoteCoLeader(clubId, memberId);
      if (response.data?.success) {
        setClub((prevClub) => ({
          ...prevClub,
          coLeaders: (prevClub.coLeaders || []).filter((c) => (c._id?.toString() || c?.toString()) !== memberId)
        }));
      }
    } catch (error) {
      setCoLeaderActionError(error.response?.data?.message || 'Failed to demote co-leader');
    }
  };

  /* ── Club actions ───────────────────────────────────────────────────── */

  const confirmLeaveClub = async () => {
    try {
      const response = await clubsAPI.leave(clubId);
      if (response.data?.success) {
        removeClub(clubId);
        navigate('/my-clubs');
      }
    } catch (error) {
      console.error('Error leaving club:', error);
    } finally {
      setShowLeaveConfirm(false);
    }
  };

  // Errors propagate to DeleteClubDialog, which shows them
  const confirmDeleteClub = async (leaderEmail, reason) => {
    const response = await clubsAPI.delete(clubId, reason, leaderEmail);
    if (response.data?.success) {
      removeClub(clubId);
      navigate('/my-clubs');
    }
  };

  const handleClubSaved = (updatedClub) => {
    setClub(updatedClub);
    setShowClubEditModal(false);
  };

  const handleOwnershipTransferred = (updatedClub) => {
    setClub(updatedClub);
    updateClub(clubId, updatedClub);
    setShowClubEditModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (clubNotFound || !club) {
    return <ClubNotFound />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <div id="main-content" role="main" className="flex-1 min-w-0 max-w-4xl min-h-screen p-4 lg:p-6 xl:p-8">
          <button
            onClick={() => navigate("/my-clubs")}
            className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white mb-5 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to My Clubs
          </button>

          <ClubHero club={club} />

          {/* Leader or co-leader, private clubs only (UC-10) */}
          {role.canModerate && club.isPrivate && (
            <PendingJoinRequests clubId={clubId} requests={pendingJoinRequests} onDecided={refreshClub} />
          )}

          {upcomingDrives.length > 0 && (
            <NextDriveCard
              drive={upcomingDrives[0]}
              rsvpCounts={driveRsvpCounts[upcomingDrives[0]._id]}
              moreCount={upcomingDrives.length - 1}
              canOpen={role.canViewDrives}
              onOpen={driveDetail.open}
              onReport={(drive) => setReportTarget({ type: 'drive', id: drive._id, name: drive.name })}
            />
          )}

          {/* Visible to all on public clubs, members/leader/co-leader only on private clubs */}
          {(!club.isPrivate || role.canViewDrives) && (
            <AnnouncementsSection
              clubId={clubId}
              announcements={announcements}
              setAnnouncements={setAnnouncements}
              canModerate={role.canModerate}
            />
          )}
        </div>

        <MobileDrawerButton onClick={() => setMobileInfoOpen(true)} breakpointClass="lg:hidden" side="right" label="club info" />

        <div
          className={
            mobileInfoOpen
              ? "flex fixed inset-0 z-50 bg-zinc-950 flex-col p-5 pt-[calc(4rem+var(--sat))] overflow-y-auto lg:inset-auto lg:z-auto lg:bg-transparent lg:flex-none lg:w-56 xl:w-72 2xl:w-80 lg:p-3 xl:p-5 2xl:p-6 lg:pt-3 xl:pt-5 2xl:pt-6 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-hidden"
              : "hidden lg:flex lg:flex-col lg:flex-none lg:w-56 xl:w-72 2xl:w-80 lg:p-3 xl:p-5 2xl:p-6 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-hidden"
          }
        >
          {mobileInfoOpen && (
            <button
              type="button"
              onClick={() => setMobileInfoOpen(false)}
              aria-label="Close club info"
              className="lg:hidden absolute top-[calc(1rem+var(--sat))] right-4 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">Club Info</h3>

          <div className="bg-zinc-900 rounded-xl xl:rounded-2xl p-3 xl:p-4 space-y-2 xl:space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Leader</p>
              <p className="font-medium">{displayName(club.leader)}</p>
            </div>
          </div>

          <ClubDrivesPanel
            upcomingDrives={upcomingDrives}
            pastDrives={pastDrives}
            role={role}
            actions={{
              onOpen: driveDetail.open,
              onEdit: setDriveBeingEdited,
              onComplete: handleMarkComplete,
              onCancel: setDriveToCancel,
              onDelete: setDriveToDelete,
              onViewAll: () => setShowAllDrivesModal(true),
              onViewPast: () => setShowPastEventsModal(true),
            }}
          />

          <div className="mt-3 xl:mt-4">
            {role.canModerate && (
              <button
                onClick={() => setShowScheduleDriveModal(true)}
                className="w-full bg-red-600 hover:bg-red-700 py-2 xl:py-3 rounded-xl xl:rounded-2xl text-sm xl:text-base font-medium flex items-center justify-center gap-2 transition mb-3 xl:mb-4"
              >
                <Plus size={18} />
                Schedule a Drive
              </button>
            )}

            <div className="border-t border-zinc-800 pt-3 xl:pt-5">
              <h3 className="font-semibold mb-2 xl:mb-4 text-sm xl:text-base">
                {role.isLeader ? "Club Settings" : "Members"}
              </h3>

              {role.isLeader && (
                <button
                  type="button"
                  onClick={() => setShowClubEditModal(true)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 py-2 xl:py-3 rounded-xl xl:rounded-2xl text-sm xl:text-base font-medium flex items-center justify-center gap-2 transition mb-3 xl:mb-4"
                >
                  <Edit3 size={18} />
                  Manage Club
                </button>
              )}

              <div className="bg-zinc-900 rounded-xl xl:rounded-2xl p-3 xl:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs xl:text-sm text-zinc-400">Members</p>
                    <p className="text-xl xl:text-2xl font-bold text-red-500">{club.members?.length || 0}</p>
                  </div>
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="text-red-500 hover:text-red-400 text-sm font-medium transition"
                  >
                    View All
                  </button>
                </div>
              </div>
            </div>

            {!role.isLeader && role.isMember && (
              <div className="mt-3 xl:mt-6 pt-3 xl:pt-5 border-t border-zinc-800">
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="w-full bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-600 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition"
                >
                  <X size={18} />
                  Leave Club
                </button>
              </div>
            )}

            {!role.isLeader && !role.isMember && (
              <JoinClubPanel
                clubId={clubId}
                initiallyBlocked={isBlockedByViewer}
                hasPendingRequest={role.hasPendingRequest}
                onJoined={refreshClub}
              />
            )}

            {role.isLeader && <InviteMembersPanel inviteCode={club.inviteCode} />}
          </div>
        </div>
      </div>

      {showAllDrivesModal && (
        <DriveListModal
          titleId="all-drives-modal-title"
          title="All Drives & Events"
          closeLabel="Dismiss drives list"
          drives={upcomingDrives}
          onSelect={(drive) => {
            driveDetail.open(drive);
            setShowAllDrivesModal(false);
          }}
          onClose={() => setShowAllDrivesModal(false)}
        />
      )}

      {showPastEventsModal && (
        <DriveListModal
          titleId="past-events-modal-title"
          title="Past Events"
          closeLabel="Dismiss past drives list"
          drives={pastDrives}
          canOpen={role.canViewDrives}
          showStatus
          onSelect={(drive) => {
            driveDetail.open(drive);
            setShowPastEventsModal(false);
          }}
          onClose={() => setShowPastEventsModal(false)}
        />
      )}

      {showMembersModal && (
        <MembersModal
          club={club}
          role={role}
          currentUserId={user?._id}
          error={coLeaderActionError}
          actions={{
            onViewProfile: openProfile,
            onReport: (member) => setReportTarget({ type: 'user', id: member._id, name: `@${member.username}` }),
            onPromote: handlePromoteCoLeader,
            onDemote: handleDemoteCoLeader,
            onRemove: (member) => requestRemoveMember(member._id, member.username),
            onShowBanned: () => setShowBannedMembers(true),
          }}
          onClose={() => setShowMembersModal(false)}
        />
      )}

      {driveBeingEdited && (
        <EditDriveModal
          drive={driveBeingEdited}
          onClose={() => setDriveBeingEdited(null)}
          onSave={handleDriveUpdated}
        />
      )}

      {driveDetail.isOpen && (
        <DriveDetailModal
          drive={driveDetail.drive}
          isMember={role.isMember}
          canModerate={role.canModerate}
          onClose={driveDetail.close}
          onViewProfile={openProfile}
          rsvp={driveDetail.modalProps.rsvp}
          checkin={driveDetail.modalProps.checkin}
          attendees={driveDetail.modalProps.attendees}
          rating={driveDetail.modalProps.rating}
          photos={{ ...driveDetail.modalProps.photos, canModerate: role.canModerate }}
        />
      )}

      <MemberProfilePanel
        userId={profilePanelTarget?.userId}
        isOpen={!!profilePanelTarget}
        onClose={() => setProfilePanelTarget(null)}
        canRemove={profilePanelTarget?.canRemove}
        onRemove={() => {
          const target = club?.members?.find((m) => m._id === profilePanelTarget?.userId);
          requestRemoveMember(profilePanelTarget.userId, target?.username || 'this member');
        }}
      />

      <BannedMembersPanel
        clubId={clubId}
        isOpen={showBannedMembers}
        onClose={() => setShowBannedMembers(false)}
      />

      {showClubEditModal && (
        <ClubEditModal
          club={club}
          currentUserId={role.userId}
          onSaved={handleClubSaved}
          onTransferred={handleOwnershipTransferred}
          onRequestDelete={() => setShowDeleteConfirm(true)}
          onClose={() => setShowClubEditModal(false)}
        />
      )}

      {showScheduleDriveModal && (
        <ScheduleDriveModal
          clubId={clubId}
          onClose={() => setShowScheduleDriveModal(false)}
          onScheduled={handleDriveScheduled}
        />
      )}

      {showLeaveConfirm && (
        <LeaveClubDialog onConfirm={confirmLeaveClub} onClose={() => setShowLeaveConfirm(false)} />
      )}

      {driveToDelete && (
        <DeleteDriveDialog drive={driveToDelete} onConfirm={confirmDeleteDrive} onClose={() => setDriveToDelete(null)} />
      )}

      {driveToCancel && (
        <CancelDriveDialog
          drive={driveToCancel}
          canCancelSeries={role.isLeader}
          onConfirm={confirmCancelDrive}
          onClose={() => setDriveToCancel(null)}
        />
      )}

      {memberToRemove && (
        <RemoveMemberDialog member={memberToRemove} onConfirm={confirmRemoveMember} onClose={() => setMemberToRemove(null)} />
      )}

      {showDeleteConfirm && (
        <DeleteClubDialog onConfirm={confirmDeleteClub} onClose={() => setShowDeleteConfirm(false)} />
      )}

      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};

export default ClubDetail;
