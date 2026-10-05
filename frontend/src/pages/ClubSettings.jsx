import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NavBar from "../components/NavBar";
import Sidebar from "../components/Sidebar";
import { ClubNotFound } from "../components/club/ClubHeader";
import ClubSettingsNav from "../components/club-settings/ClubSettingsNav";
import { CLUB_SETTINGS_SECTIONS, DEFAULT_CLUB_SETTINGS_SECTION } from "../components/club-settings/sections";
import { clubsAPI } from "../services/api";
import { useClubs } from "../hooks/useClubs";
import { getClubRole } from "../lib/clubRole";

/**
 * Leader-only settings for one club, at /club/:clubId/settings/:section.
 * The sections themselves are listed in components/club-settings/sections.js.
 */
const ClubSettings = ({ user, onLogout }) => {
  const { clubId, section } = useParams();
  const navigate = useNavigate();
  const { updateClub, removeClub } = useClubs();

  const [club, setClub] = useState(null);
  const [failedClubId, setFailedClubId] = useState(null);

  useEffect(() => {
    let ignore = false;
    clubsAPI.getClubById(clubId)
      .then((response) => {
        if (ignore) return;
        if (response.data?.success) setClub(response.data.club);
        else setFailedClubId(clubId);
      })
      .catch(() => { if (!ignore) setFailedClubId(clubId); });
    return () => { ignore = true; };
  }, [clubId]);

  if (failedClubId === clubId) {
    return <ClubNotFound />;
  }

  // Also covers the moment after the URL moves to a different club
  if (club?._id !== clubId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const role = getClubRole(club, user);
  if (!role.isLeader) {
    return <Navigate to={`/club/${clubId}`} replace />;
  }

  const activeSection = CLUB_SETTINGS_SECTIONS.find((s) => s.id === section);
  if (!activeSection) {
    return <Navigate to={`/club/${clubId}/settings/${DEFAULT_CLUB_SETTINGS_SECTION}`} replace />;
  }

  // Merged, not replaced: the update endpoint returns the club without its
  // populated leader and members. The shared list keeps the sidebar in step.
  const handleClubUpdated = (changes) => {
    setClub((prev) => ({ ...prev, ...changes }));
    updateClub(clubId, changes);
  };

  // The viewer is a regular member now, so the settings are no longer theirs
  const handleOwnershipTransferred = (updatedClub) => {
    updateClub(clubId, updatedClub);
    navigate(`/club/${clubId}`, { replace: true });
  };

  const handleClubDeleted = () => {
    removeClub(clubId);
    navigate('/my-clubs');
  };

  const ActiveSection = activeSection.Component;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <main id="main-content" className="flex-1 min-w-0 min-h-screen p-4 lg:p-6 xl:p-8">
          <button
            onClick={() => navigate(`/club/${clubId}`)}
            className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white mb-5 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to club
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold">Club Settings</h1>
            <p className="text-sm text-zinc-400 mt-1">{club.name}</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
            <ClubSettingsNav clubId={clubId} />
            <div className="flex-1 min-w-0 max-w-2xl">
              <ActiveSection
                key={club._id}
                club={club}
                currentUserId={role.userId}
                onClubUpdated={handleClubUpdated}
                onOwnershipTransferred={handleOwnershipTransferred}
                onClubDeleted={handleClubDeleted}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ClubSettings;
