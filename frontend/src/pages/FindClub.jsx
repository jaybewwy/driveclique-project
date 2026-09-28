import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Search, X } from "lucide-react";
import { SkeletonCard } from "../components/Skeleton";
import { clubsAPI } from "../services/api";
import { useClubs } from "../hooks/useClubs";
import { useNearbySearch } from "../hooks/useNearbySearch";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import ReportModal from "../components/ui/ReportModal";
import BlockedClubsPanel from "../components/ui/BlockedClubsPanel";
import ClubTagPicker from "../components/ui/ClubTagPicker";
import ClubResultCard from "../components/find-club/ClubResultCard";
import FindClubSidebar from "../components/find-club/FindClubSidebar";
import JoinByCodeScreen from "../components/find-club/JoinByCodeScreen";
import { NearbyDrivesSection, SearchNearPanel } from "../components/find-club/NearbySearch";
import { trackEvent } from "../services/analytics";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const Banner = ({ tone, message, onDismiss }) => {
  const styles = tone === "error"
    ? { box: "bg-red-500/10 border-red-500/30", text: "text-red-400", button: "text-red-400 hover:text-red-300" }
    : { box: "bg-green-500/10 border-green-500/30", text: "text-green-400", button: "text-green-400 hover:text-green-300" };
  return (
    <div className={`${styles.box} border rounded-xl p-3 mb-4 flex items-center justify-between gap-2`}>
      <p className={`${styles.text} text-sm`}>{message}</p>
      <button onClick={onDismiss} className={`${styles.button} shrink-0`}><X className="w-4 h-4" /></button>
    </div>
  );
};

const FindClub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { refreshClubs } = useClubs();
  const nearby = useNearbySearch();
  const { near, radius } = nearby;

  const [clubs, setClubs]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [popularClubs, setPopularClubs] = useState([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [page, setPage]                 = useState(1);
  const [pagination, setPagination]     = useState(null);
  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [actionError, setActionError]   = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [mobilePopularOpen, setMobilePopularOpen] = useState(false);
  const [blockingId, setBlockingId] = useState(null);
  const [showBlockedClubs, setShowBlockedClubs] = useState(false);

  useEffect(() => {
    clubsAPI.searchPage(undefined, 1, 50)
      .then(res => {
        if (res.data.success) {
          setPopularClubs(
            [...res.data.clubs].sort((a, b) => b.members.length - a.members.length).slice(0, 5)
          );
        }
      })
      .catch((error) => console.error('Failed to load popular clubs:', error));
  }, []);

  useEffect(() => { setPage(1); }, [searchQuery, selectedTags, near, radius]);

  useEffect(() => {
    setLoading(true);
    const fetchClubs = async () => {
      try {
        const nearParams = near ? { lat: near.lat, lng: near.lng, radius } : undefined;
        const response = await clubsAPI.searchPage(searchQuery.trim() || undefined, page, PAGE_SIZE, selectedTags, nearParams);
        if (response.data.success) {
          setClubs(response.data.clubs);
          setPagination(response.data.pagination);
        }
      } catch (error) {
        console.error("Error fetching clubs:", error);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchClubs, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTags, page, near, radius]);

  const isUserMember = (club) =>
    club.members.some(m => typeof m === 'string' ? m === user?._id : m._id === user?._id);

  const filteredClubs = clubs.filter(c => !c.isPrivate);

  const clearBanners = () => {
    setActionError('');
    setActionSuccess('');
  };

  const handleJoinClub = async (clubId) => {
    clearBanners();
    try {
      const response = await clubsAPI.requestToJoin(clubId);
      if (response.data.success) {
        if (response.data.clubId) {
          trackEvent('CLUB_JOINED', { via: 'browse' });
          await refreshClubs();
          navigate(`/club/${response.data.clubId}`);
        } else setActionSuccess("Join request sent! Awaiting leader approval.");
      }
    } catch (error) {
      setActionError(error.response?.data?.message || "Failed to join club");
    }
  };

  const handleBlockClub = async (clubId) => {
    clearBanners();
    setBlockingId(clubId);
    try {
      const response = await clubsAPI.blockClub(clubId);
      if (response.data.success) {
        // Blocked clubs never appear in browse results — mirror that
        // locally instead of waiting on a refetch, so the card disappears
        // immediately. The Popular sidebar is a separate, independently
        // fetched list, so it needs the same local filter or a newly
        // blocked club can keep showing there too.
        setClubs((prev) => prev.filter((c) => c._id !== clubId));
        setPopularClubs((prev) => prev.filter((c) => c._id !== clubId));
        setActionSuccess("Club blocked. It won't show up in search anymore.");
      }
    } catch (error) {
      setActionError(error.response?.data?.message || "Failed to block club");
    } finally {
      setBlockingId(null);
    }
  };

  // Rejects on failure, which JoinByCodeScreen reports as a wrong code
  const joinByCode = async (code) => {
    const response = await clubsAPI.joinByInviteCode(code);
    if (!response.data.success) return;
    if (response.data.pending) {
      // Private club — the code submitted a join request, not instant membership (UC-10)
      setShowJoinByCode(false);
      setActionSuccess("Join request sent! Awaiting leader approval.");
      return;
    }
    trackEvent('CLUB_JOINED', { via: 'inviteCode' });
    await refreshClubs();
    const clubId = response.data.clubId || response.data.club?._id;
    if (clubId) navigate(`/club/${clubId}`);
    else { setShowJoinByCode(false); setActionSuccess("Joined club successfully!"); }
  };

  if (showJoinByCode) {
    return <JoinByCodeScreen onSubmit={joinByCode} onClose={() => setShowJoinByCode(false)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} showSearch={false} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        <div id="main-content" role="main" className="flex-1 min-w-0 max-w-4xl min-h-screen p-5 md:p-6">
          <div className="mb-6">
            <p className="section-label mb-1.5">Discovery</p>
            <h1 className="text-2xl font-bold text-white">Find Clubs</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Discover and join car clubs near you</p>
          </div>

          {actionError && <Banner tone="error" message={actionError} onDismiss={() => setActionError('')} />}
          {actionSuccess && <Banner tone="success" message={actionSuccess} onDismiss={() => setActionSuccess('')} />}

          {/* Search bar */}
          <div className="mb-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder=""
                className="w-full h-11 bg-white/[0.06] border border-white/[0.08] rounded-2xl pl-11 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/15 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-zinc-400 text-xs mt-2 pl-1">
              <span className="text-zinc-400 font-medium">{pagination?.total ?? filteredClubs.length}</span> clubs found
            </p>
          </div>

          <SearchNearPanel search={nearby} />

          <div className="mb-5">
            <ClubTagPicker selected={selectedTags} onChange={setSelectedTags} />
          </div>

          {near && (
            <NearbyDrivesSection
              radius={radius}
              drives={nearby.nearbyDrives}
              onOpenClub={(clubId) => navigate(`/club/${clubId}`)}
            />
          )}

          {/* Results */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-16 glass-subtle rounded-3xl">
              <Car className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-base font-semibold text-zinc-400">
                {near ? `No clubs within ${radius} mi` : "No clubs found"}
              </p>
              <p className="text-sm text-zinc-400 mt-1 mb-5">
                {near ? "Try a bigger radius, or create a club in your area" : "Try a different search or create your own"}
              </p>
              <button
                onClick={() => navigate("/create-club")}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                Create a Club
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClubs.map((club) => (
                <ClubResultCard
                  key={club._id}
                  club={club}
                  isMember={isUserMember(club)}
                  isBlocking={blockingId === club._id}
                  onOpen={() => navigate(`/club/${club._id}`)}
                  onReport={() => setReportTarget({ type: 'club', id: club._id, name: club.name })}
                  onBlock={() => handleBlockClub(club._id)}
                  onJoin={() => handleJoinClub(club._id)}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-xs text-zinc-400">
                <span className="text-white font-medium">{page}</span> / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasMore}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <FindClubSidebar
          popularClubs={popularClubs}
          mobileOpen={mobilePopularOpen}
          onMobileOpen={() => setMobilePopularOpen(true)}
          onMobileClose={() => setMobilePopularOpen(false)}
          onOpenClub={(clubId) => navigate(`/club/${clubId}`)}
          onJoinByCode={() => setShowJoinByCode(true)}
          onShowBlocked={() => setShowBlockedClubs(true)}
        />
      </div>

      <BlockedClubsPanel isOpen={showBlockedClubs} onClose={() => setShowBlockedClubs(false)} />

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

export default FindClub;
