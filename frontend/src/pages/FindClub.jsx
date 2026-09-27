import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SkeletonCard } from "../components/Skeleton";
import { clubsAPI, drivesAPI } from "../services/api";
import { useClubs } from "../hooks/useClubs";
import { Car, MapPin, Lock, Globe, Users, Calendar, X, Search, Sparkles, ArrowRight, Flag, Ban, ShieldOff, LocateFixed, Navigation } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import ReportModal from "../components/ui/ReportModal";
import BlockedClubsPanel from "../components/ui/BlockedClubsPanel";
import { MobileDrawerButton } from "../components/ui/MobileDrawer";
import ClubTagPicker from "../components/ui/ClubTagPicker";
import { LocationSearch } from "../components/ui/location-search";
import { trackEvent } from "../services/analytics";

// Proximity search (UC-46). Radius is in miles and must stay within the
// backend's MAX_SEARCH_RADIUS_MILES (250).
const RADIUS_OPTIONS = [10, 25, 50, 100, 250];
const DEFAULT_RADIUS = 25;
const NEARBY_DRIVES_LIMIT = 6;

// Browser coordinates are rounded to ~1 km before they go anywhere — plenty
// for a radius search, and they end up in request URLs and access logs.
const roundCoord = (n) => Math.round(n * 100) / 100;

// Drive dates are stored as UTC midnight (see lib/dateUtils.js), so format
// in UTC or viewers west of Greenwich see the day before
const formatDriveDate = (date) =>
  new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const FindClub = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { refreshClubs } = useClubs();
  const [clubs, setClubs]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [popularClubs, setPopularClubs] = useState([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [page, setPage]                 = useState(1);
  const [pagination, setPagination]     = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode]     = useState("");
  const [joinError, setJoinError]       = useState("");
  const [joinLoading, setJoinLoading]   = useState(false);
  const [actionError, setActionError]   = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [mobilePopularOpen, setMobilePopularOpen] = useState(false);
  const [blockingId, setBlockingId] = useState(null);
  const [showBlockedClubs, setShowBlockedClubs] = useState(false);
  // Proximity search (UC-46) — `near` is the active search center
  const [near, setNear]                 = useState(null); // { lat, lng, label }
  const [nearQuery, setNearQuery]       = useState("");
  const [radius, setRadius]             = useState(DEFAULT_RADIUS);
  const [locating, setLocating]         = useState(false);
  const [locationError, setLocationError] = useState("");
  const [nearbyDrives, setNearbyDrives] = useState(null); // null while loading

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
        const response = await clubsAPI.searchPage(searchQuery.trim() || undefined, page, 20, selectedTags, nearParams);
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
    const timer = setTimeout(fetchClubs, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTags, page, near, radius]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    setNearbyDrives(null);
    drivesAPI.getNearby(near.lat, near.lng, radius, NEARBY_DRIVES_LIMIT)
      .then((res) => {
        if (!cancelled && res.data.success) setNearbyDrives(res.data.drives);
      })
      .catch((error) => {
        console.error("Failed to load nearby drives:", error);
        if (!cancelled) setNearbyDrives([]);
      });
    return () => { cancelled = true; };
  }, [near, radius]);

  const handleUseMyLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Your browser can't share its location. Pick a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNear({ lat: roundCoord(coords.latitude), lng: roundCoord(coords.longitude), label: "your location" });
        setNearQuery("");
        setLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location access is blocked for this site. Pick a city instead."
            : "Couldn't get your location. Pick a city instead."
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const clearNear = () => {
    setNear(null);
    setNearQuery("");
    setLocationError("");
  };

  const isUserMember = (club) =>
    club.members.some(m => typeof m === 'string' ? m === user?._id : m._id === user?._id);

  const filteredClubs = clubs.filter(c => !c.isPrivate);

  const handleJoinClub = async (clubId, e) => {
    e.stopPropagation();
    setActionError('');
    setActionSuccess('');
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

  const handleBlockClub = async (clubId, e) => {
    e.stopPropagation();
    setActionError('');
    setActionSuccess('');
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

  const handleJoinByCode = () => { setShowJoinModal(true); setInviteCode(""); setJoinError(""); };

  const submitJoinByCode = async () => {
    if (!inviteCode.trim()) { setJoinError("Please enter an invite code"); return; }
    setJoinLoading(true);
    setJoinError("");
    try {
      const response = await clubsAPI.joinByInviteCode(inviteCode.trim());
      if (response.data.success) {
        if (response.data.pending) {
          // Private club — the code submitted a join request, not instant membership (UC-10)
          setShowJoinModal(false);
          setActionSuccess("Join request sent! Awaiting leader approval.");
        } else {
          trackEvent('CLUB_JOINED', { via: 'inviteCode' });
          await refreshClubs();
          const clubId = response.data.clubId || response.data.club?._id;
          if (clubId) navigate(`/club/${clubId}`);
          else { setShowJoinModal(false); setActionSuccess("Joined club successfully!"); }
        }
      }
    } catch {
      setJoinError("Invite code incorrect.");
    } finally {
      setJoinLoading(false);
    }
  };

  const closeModal = () => { setShowJoinModal(false); setInviteCode(""); setJoinError(""); };

  /* ── Invite-code modal ────────────────────────────────────────────────── */
  if (showJoinModal) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div role="presentation" aria-hidden="true" className="fixed inset-0 bg-black/70 backdrop-blur-xl" onClick={closeModal} />
        <div className="relative glass-card p-8 max-w-sm w-full animate-fade-slide-up rounded-3xl">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded-lg transition-all"
          >
            <X size={16} />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Join with Invite Code</h2>
            <p className="text-zinc-400 text-sm">Enter the code from a club leader</p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. HRK707"
              className="w-full bg-white/[0.06] border border-white/[0.10] rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus follows the user's own "Join with Invite Code" click, not page load
              autoFocus
            />

            {joinError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center">{joinError}</p>
              </div>
            )}

            <button
              onClick={submitJoinByCode}
              disabled={joinLoading}
              className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"
            >
              {joinLoading ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Joining…</>
              ) : "Join Club"}
            </button>
          </div>

          <p className="text-zinc-400 text-xs text-center mt-5">
            Contact a club leader to get your invite code
          </p>
        </div>
      </div>
    );
  }

  /* ── Main page ────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} showSearch={false} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main content */}
        <div id="main-content" role="main" className="flex-1 min-w-0 max-w-4xl min-h-screen p-5 md:p-6">

          {/* Page header */}
          <div className="mb-6">
            <p className="section-label mb-1.5">Discovery</p>
            <h1 className="text-2xl font-bold text-white">Find Clubs</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Discover and join car clubs near you</p>
          </div>

          {/* Feedback banners */}
          {actionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
              <p className="text-red-400 text-sm">{actionError}</p>
              <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-300 shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}
          {actionSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
              <p className="text-green-400 text-sm">{actionSuccess}</p>
              <button onClick={() => setActionSuccess('')} className="text-green-400 hover:text-green-300 shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

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

          {/* Distance filter (UC-46). relative z-20: backdrop-blur makes this a
              stacking context, and without it the city dropdown would paint
              underneath the (also blurred) result cards that follow. */}
          <div className="relative z-20 mb-5 glass-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Navigation className="w-4 h-4 text-red-400" /> Search near
              </p>
              {near && (
                <button
                  type="button"
                  onClick={clearNear}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Clear distance filter
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="btn-ghost h-11 px-4 text-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LocateFixed className="w-4 h-4" /> {locating ? "Locating…" : "Use my location"}
              </button>
              <div className="flex-1 min-w-0">
                <label htmlFor="find-club-near" className="sr-only">City to search near</label>
                <LocationSearch
                  id="find-club-near"
                  value={nearQuery}
                  onChange={setNearQuery}
                  onSelect={({ label, lat, lng }) => {
                    setNear({ lat, lng, label });
                    setLocationError("");
                  }}
                />
              </div>
              <label htmlFor="find-club-radius" className="sr-only">Search radius</label>
              <select
                id="find-club-radius"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="h-11 bg-white/[0.06] border border-white/[0.10] rounded-2xl px-3 text-sm text-white focus:outline-none focus:border-red-500/40 shrink-0"
              >
                {RADIUS_OPTIONS.map((miles) => (
                  <option key={miles} value={miles} className="bg-zinc-900">Within {miles} mi</option>
                ))}
              </select>
            </div>
            {locationError && <p className="text-xs text-red-400 mt-2">{locationError}</p>}
            {near && (
              <p className="text-xs text-zinc-400 mt-2">
                Clubs within {radius} mi of {near.label}, nearest first. Clubs without a pinned location aren't included.
              </p>
            )}
          </div>

          {/* Tag filters */}
          <div className="mb-5">
            <ClubTagPicker selected={selectedTags} onChange={setSelectedTags} />
          </div>

          {/* Upcoming drives near the search center (UC-46) */}
          {near && (
            <section aria-labelledby="nearby-drives-heading" className="mb-6">
              <h2 id="nearby-drives-heading" className="section-label mb-3">
                Upcoming drives within {radius} mi
              </h2>
              {nearbyDrives === null ? (
                <p className="text-sm text-zinc-400">Looking for drives…</p>
              ) : nearbyDrives.length === 0 ? (
                <p className="text-sm text-zinc-400 glass-subtle rounded-2xl p-4">
                  No upcoming drives with a meeting-point pin in this area yet.
                </p>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-3">
                  {nearbyDrives.map((drive) => (
                    <li key={drive._id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/club/${drive.club._id}`)}
                        className="w-full text-left glass-card p-4 rounded-2xl hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <p className="font-semibold text-white truncate">{drive.name}</p>
                        <p className="text-xs text-zinc-400 truncate mb-2">{drive.club.name}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDriveDate(drive.date)}{drive.time ? ` · ${drive.time}` : ""}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Navigation className="w-3.5 h-3.5" /> {drive.distanceMiles} mi away
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
                <div
                  key={club._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/club/${club._id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/club/${club._id}`);
                    }
                  }}
                  className="glass-card p-5 cursor-pointer hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200 group rounded-3xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Club avatar */}
                      <div className="w-11 h-11 rounded-xl shrink-0 overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-red-500/20 transition-all">
                        {club.avatar ? (
                          <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                            <span className="text-white font-bold">{club.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name + badge row */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate min-w-0">
                            {club.name}
                          </h3>
                          {club.isPrivate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-[10px] text-zinc-400">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] text-green-500">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-zinc-400 line-clamp-1 mb-2">
                          {club.description || "No description"}
                        </p>

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
                          </span>
                          {club.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[160px]">{club.location}</span>
                            </span>
                          )}
                          {club.distanceMiles !== undefined && (
                            <span className="flex items-center gap-1.5 text-zinc-300">
                              <Navigation className="w-3.5 h-3.5" />
                              {club.distanceMiles} mi away
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        {club.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {club.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-[10px] text-zinc-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CTA + report */}
                    <div className="shrink-0 self-center flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setReportTarget({ type: 'club', id: club._id, name: club.name }); }}
                        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
                        title="Report club"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                      {!isUserMember(club) && (
                        <button
                          onClick={(e) => handleBlockClub(club._id, e)}
                          disabled={blockingId === club._id}
                          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Block club"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isUserMember(club) ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/club/${club._id}`); }}
                          className="btn-ghost px-4 py-2 text-xs font-medium flex items-center gap-1.5"
                        >
                          View <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleJoinClub(club._id, e)}
                          className="btn-primary px-4 py-2 text-xs font-medium"
                        >
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
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

        {/* Right sidebar */}
        <MobileDrawerButton onClick={() => setMobilePopularOpen(true)} breakpointClass="xl:hidden" side="right" label="popular clubs" />

        <div
          className={
            mobilePopularOpen
              ? "flex fixed inset-0 z-50 bg-zinc-950 flex-col p-5 pt-[calc(4rem+var(--sat))] overflow-y-auto gap-5 xl:inset-auto xl:z-auto xl:bg-transparent xl:w-72 xl:pt-5 xl:sticky xl:top-[49px] xl:h-[calc(100vh-49px)]"
              : "hidden xl:flex xl:flex-col xl:w-72 xl:p-5 xl:sticky xl:top-[49px] xl:h-[calc(100vh-49px)] xl:overflow-y-auto xl:gap-5"
          }
        >
          {mobilePopularOpen && (
            <button
              type="button"
              onClick={() => setMobilePopularOpen(false)}
              aria-label="Close popular clubs"
              className="xl:hidden absolute top-[calc(1rem+var(--sat))] right-4 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Popular clubs */}
          <div>
            <p className="section-label mb-3">Popular</p>
            <div className="space-y-2">
              {popularClubs.map((club) => (
                <button
                  type="button"
                  key={club._id}
                  onClick={() => navigate(`/club/${club._id}`)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/[0.05] group transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden ring-1 ring-white/[0.08]">
                    {club.avatar ? (
                      <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">{club.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors truncate">{club.name}</p>
                    <p className="text-[11px] text-zinc-400">{club.members.length} {club.members.length === 1 ? 'member' : 'members'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Join by code */}
          <button
            onClick={handleJoinByCode}
            className="w-full btn-ghost px-4 py-3 text-sm flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Join with Code
          </button>

          {/* Blocked clubs */}
          <button
            type="button"
            onClick={() => setShowBlockedClubs(true)}
            className="w-full btn-ghost px-4 py-3 text-sm flex items-center justify-center gap-2"
          >
            <ShieldOff className="w-4 h-4" /> Blocked Clubs
          </button>

          {/* Why join card */}
          <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-red-500/8 to-orange-500/6 border border-red-500/15">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-white">Why join a club?</p>
            </div>
            <ul className="space-y-1.5">
              {[
                { icon: Users,    text: "Connect with enthusiasts" },
                { icon: Calendar, text: "Access exclusive drives" },
                { icon: Car,      text: "Share knowledge & tips" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <Icon className="w-3 h-3 text-red-400 shrink-0" /> {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <BlockedClubsPanel isOpen={showBlockedClubs} onClose={() => setShowBlockedClubs(false)} />

      {/* Report modal */}
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
