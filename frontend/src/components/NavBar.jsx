import { Search, Home, Users, Settings, Bell, Menu, X, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { useNotifications } from "../hooks/useNotifications";
import UserDropdown from "./ui/user-dropdown";
import NotificationPanel from "./ui/notification-panel";
import Logo from "./ui/Logo";

const getInitials = (user) => {
  if (user?.firstName && user?.lastName)
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  if (user?.name) return user.name.slice(0, 2).toUpperCase();
  if (user?.username) return user.username.slice(0, 2).toUpperCase();
  return "?";
};

const NavBar = ({ user, onLogout, showSearch = true }) => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("online");
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifBellRef = useRef(null);

  const isAuthenticated = !!user;
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications(isAuthenticated);

  const userDropdownData = {
    name: user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.name || user?.username || "Driver",
    username: `@${user?.username || "driver"}`,
    avatar: user?.avatar || null,
    initials: getInitials(user),
    status: selectedStatus,
  };

  const handleDropdownAction = (action) => {
    switch (action) {
      case "profile":      navigate("/profile");      break;
      case "notifications":navigate("/settings");     break;
      case "settings":     navigate("/settings");     break;
      case "my-clubs":     navigate("/my-clubs");     break;
      case "find-club":    navigate("/find-club");    break;
      case "dashboard":    navigate("/dashboard");    break;
      case "create-club":  navigate("/create-club");  break;
      case "logout":       onLogout();                break;
      default:             break;
    }
  };

  return (
    <>
      {/* ── Main nav bar ──────────────────────────────────────────────── */}
      <nav className="bg-zinc-950/90 backdrop-blur-2xl border-b border-white/[0.06] px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 transition-all duration-300">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="hover:scale-105 active:scale-95 transition-all duration-200"
            aria-label="Go to dashboard"
          >
            <Logo size={32} />
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="hidden sm:flex items-center gap-1.5 group"
            aria-label="DriveClique home"
          >
            <span className="text-base font-bold tracking-tight text-white group-hover:text-zinc-200 transition-colors">Drive</span>
            <span className="text-base font-bold tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Clique</span>
          </button>
        </div>

        {/* Search Bar — desktop */}
        {showSearch && (
          <div className="flex-1 max-w-md mx-6 hidden md:block">
            <div className={`relative transition-all duration-200 ${searchFocused ? "scale-[1.01]" : ""}`}>
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${searchFocused ? "text-red-400" : "text-zinc-400"}`} />
              <input
                type="text"
                placeholder=""
                aria-label="Search"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full h-9 bg-white/[0.06] border border-white/[0.08] rounded-full pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/40 focus:bg-white/[0.09] focus:ring-2 focus:ring-red-500/10 transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* Mobile search icon */}
        {showSearch && (
          <button className="md:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all duration-200">
            <Search className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Notification Bell */}
          <div className="relative hidden sm:flex" ref={notifBellRef}>
            <button
              onClick={() => setShowNotifPanel((p) => !p)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.07] transition-all duration-200"
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifPanel && (
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                markAllRead={markAllRead}
                markOneRead={markOneRead}
                onClose={() => setShowNotifPanel(false)}
                excludeRef={notifBellRef}
              />
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-white/[0.08] mx-1" />

          {/* User dropdown — desktop */}
          <div className="hidden sm:flex items-center">
            <UserDropdown
              user={userDropdownData}
              onAction={handleDropdownAction}
              onStatusChange={setSelectedStatus}
              selectedStatus={selectedStatus}
            />
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden w-9 h-9 flex items-center justify-center hover:bg-white/[0.07] rounded-xl transition-all duration-200 text-zinc-300"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile fullscreen menu ─────────────────────────────────────── */}
      {showMobileMenu && (
        <div className="sm:hidden fixed inset-0 top-[49px] bg-zinc-950/98 backdrop-blur-2xl z-40 animate-fade-slide-up">
          <div className="p-4 space-y-1">

            {/* User info header */}
            <div className="flex items-center gap-3 px-4 py-3.5 mb-3 bg-white/[0.04] border border-white/[0.07] rounded-2xl">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={userDropdownData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(user)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{userDropdownData.name}</p>
                <p className="text-zinc-400 text-xs leading-tight mt-0.5">{userDropdownData.username}</p>
              </div>
            </div>

            {[
              { label: "Dashboard",       icon: Home,    path: "/dashboard" },
              { label: "My Clubs",        icon: Users,   path: "/my-clubs" },
              { label: "Find Clubs",      icon: Search,  path: "/find-club" },
              { label: "Profile & Settings", icon: Settings, path: "/profile" },
            ].map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                onClick={() => { navigate(path); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
              >
                <Icon className="w-4.5 h-4.5 text-zinc-400" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}

            <div className="border-t border-white/[0.06] my-2 mx-4" />

            <button
              onClick={() => { onLogout(); setShowMobileMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-4.5 h-4.5" />
              <span className="text-sm font-medium">Log out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NavBar;
