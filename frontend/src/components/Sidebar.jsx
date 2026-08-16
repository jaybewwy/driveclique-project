import { useState, useEffect } from "react";
import { Home, User, Users, Search, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { drivesAPI } from "../services/api";
import { useClubs } from "../hooks/useClubs";
import { MobileDrawerButton, MobileDrawer } from "./ui/MobileDrawer";

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-3 mb-2">{children}</p>
);

const NavItem = ({ icon: Icon, label, active, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
      active
        ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-900/30"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
    }`}
  >
    <Icon className={`w-[18px] h-[18px] ${active ? "text-white" : "text-zinc-400"}`} />
    <span className={`text-sm flex-1 ${active ? "font-semibold" : ""}`}>{label}</span>
    {typeof badge === "number" && badge > 0 && (
      <span
        className={`text-[11px] font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center ${
          active ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-300"
        }`}
      >
        {badge}
      </span>
    )}
  </button>
);

const Sidebar = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clubs: userClubs } = useClubs();
  const [scheduledDrivesCount, setScheduledDrivesCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = user?.useDisplayName && user?.name ? user.name : user?.username;

  const goTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sortedClubs = [...userClubs].sort((a, b) => {
    const aIsLeader = a.leader === user?._id || a.leader?._id === user?._id;
    const bIsLeader = b.leader === user?._id || b.leader?._id === user?._id;
    if (aIsLeader && !bIsLeader) return -1;
    if (!aIsLeader && bIsLeader) return 1;
    return 0;
  });

  // Count scheduled drives whenever the shared clubs list changes
  useEffect(() => {
    if (userClubs.length === 0) { setScheduledDrivesCount(0); return; }
    const now = new Date();
    Promise.all(userClubs.map(c => drivesAPI.getClubDrives(c._id)))
      .then(results => {
        let count = 0;
        results.forEach(res => {
          if (res.data.success && res.data.drives) {
            res.data.drives.forEach(drive => {
              if (!drive.isCancelled && !drive.isCompleted && new Date(drive.date) >= now) count++;
            });
          }
        });
        setScheduledDrivesCount(count);
      })
      .catch((error) => console.error('Failed to load scheduled drives count:', error));
  }, [userClubs]);

  const isActive = (path) => location.pathname === path;

  const content = (
    <>
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Main */}
        <div>
          <SectionLabel>Main</SectionLabel>
          <div className="space-y-1">
            <NavItem
              icon={Home}
              label="Home"
              active={isActive("/dashboard")}
              badge={scheduledDrivesCount}
              onClick={() => goTo("/dashboard")}
            />
            <NavItem icon={User} label="Profile" active={isActive("/profile")} onClick={() => goTo("/profile")} />
          </div>
        </div>

        {/* Clubs */}
        <div>
          <SectionLabel>Clubs</SectionLabel>
          <div className="space-y-1">
            <NavItem
              icon={Users}
              label="My Clubs"
              active={isActive("/my-clubs")}
              badge={userClubs.length}
              onClick={() => goTo("/my-clubs")}
            />
            <NavItem
              icon={Search}
              label="Find Clubs"
              active={isActive("/find-club")}
              onClick={() => goTo("/find-club")}
            />
          </div>
        </div>

        {/* Your Clubs shortcuts - hidden on My Clubs page */}
        {userClubs.length > 0 && location.pathname !== "/my-clubs" && (
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <SectionLabel>Your Clubs</SectionLabel>
              <button
                onClick={() => goTo("/my-clubs")}
                className="text-zinc-400 hover:text-white transition-colors flex items-center -mb-2"
                aria-label="View all clubs"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {sortedClubs.slice(0, sortedClubs.length > 3 ? 3 : 5).map((club) => (
                <button
                  type="button"
                  key={club._id}
                  onClick={() => goTo(`/club/${club._id}`)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-zinc-900/50 rounded-xl cursor-pointer transition-all duration-200 group"
                >
                  <div className="w-7 h-7 rounded-lg flex-shrink-0 overflow-hidden ring-1 ring-zinc-700/30 group-hover:ring-zinc-600/50 transition-all duration-300">
                    {club.avatar ? (
                      <img
                        src={club.avatar}
                        alt={club.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                        <span className="text-white font-bold text-[10px]">
                          {club.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-zinc-400 truncate flex-1 group-hover:text-zinc-200 transition-colors">
                    {club.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User card pinned to bottom */}
      {displayName && (
        <button
          type="button"
          onClick={() => goTo("/profile")}
          className="w-full text-left flex items-center gap-3 px-3 py-3 mt-4 bg-zinc-900 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 cursor-pointer transition-all duration-300 flex-shrink-0"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-zinc-700/30">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-zinc-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate text-white">{displayName}</p>
            <p className="text-xs text-zinc-400 truncate">@{user?.username}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Main navigation" className="w-60 xl:w-64 2xl:w-72 flex-none hidden xl:flex flex-col border-r border-zinc-800/50 p-3 xl:p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden bg-black/20">
        {content}
      </nav>

      {/* Mobile trigger + drawer (shown once the desktop sidebar is hidden below xl) */}
      <MobileDrawerButton onClick={() => setMobileOpen(true)} breakpointClass="xl:hidden" side="left" label="navigation" />
      <MobileDrawer isOpen={mobileOpen} onClose={() => setMobileOpen(false)} side="left">
        <div className="flex flex-col h-full">{content}</div>
      </MobileDrawer>
    </>
  );
};

export default Sidebar;
