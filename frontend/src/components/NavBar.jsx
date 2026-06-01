import { Car, Search, Home, Users, Settings, Bell, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { useNotifications } from "../hooks/useNotifications";
import UserDropdown from "./ui/user-dropdown";
import NotificationPanel from "./ui/notification-panel";

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
      case "profile":
      case "settings":
      case "notifications":
        navigate("/profile");
        break;
      case "my-clubs":
        navigate("/my-clubs");
        break;
      case "find-club":
        navigate("/find-club");
        break;
      case "dashboard":
        navigate("/dashboard");
        break;
      case "create-club":
        navigate("/create-club");
        break;
      case "logout":
        onLogout();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <nav className="bg-black/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 py-3 flex items-center justify-between sticky top-0 z-50 transition-all duration-300">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center cursor-pointer shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all duration-300 hover:scale-105"
            onClick={() => navigate("/dashboard")}
          >
            <Car className="w-5 h-5 text-white" />
          </div>
          <h1
            className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent cursor-pointer hidden sm:block"
            onClick={() => navigate("/dashboard")}
          >
            DriveClique
          </h1>
        </div>

        {/* Search Bar — desktop */}
        {showSearch && (
          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className={`relative transition-all duration-300 ${searchFocused ? "scale-[1.02]" : ""}`}>
              <input
                type="text"
                placeholder="Search clubs, drives, or members..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-full py-3 pl-12 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:bg-zinc-900 focus:ring-2 focus:ring-red-500/10 transition-all duration-300"
              />
              <Search className={`absolute left-4 top-3.5 w-5 h-5 transition-colors duration-300 ${searchFocused ? "text-red-500" : "text-zinc-500"}`} />
            </div>
          </div>
        )}

        {/* Mobile Search icon */}
        <button className="md:hidden p-2 hover:bg-zinc-800 rounded-full transition" onClick={() => {}}>
          <Search className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification Bell */}
          <div className="relative hidden sm:flex" ref={notifBellRef}>
            <button
              onClick={() => setShowNotifPanel((p) => !p)}
              className="relative p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
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
              />
            )}
          </div>

          {/* User avatar dropdown — desktop */}
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
            className="sm:hidden p-2 hover:bg-zinc-800 rounded-xl transition"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="sm:hidden fixed inset-0 top-16 bg-black/95 backdrop-blur-xl z-40">
          <div className="p-4 space-y-2">
            {/* User info header */}
            <div className="flex items-center gap-3 px-4 py-3 mb-2 border-b border-zinc-800">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(user)}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{userDropdownData.name}</p>
                <p className="text-zinc-500 text-xs">{userDropdownData.username}</p>
              </div>
            </div>

            <button onClick={() => { navigate("/dashboard"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition text-white">
              <Home className="w-5 h-5" /><span>Dashboard</span>
            </button>
            <button onClick={() => { navigate("/my-clubs"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition text-white">
              <Users className="w-5 h-5" /><span>My Clubs</span>
            </button>
            <button onClick={() => { navigate("/find-club"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition text-white">
              <Search className="w-5 h-5" /><span>Find Clubs</span>
            </button>
            <button onClick={() => { navigate("/profile"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition text-white">
              <Settings className="w-5 h-5" /><span>Profile &amp; Settings</span>
            </button>

            <div className="border-t border-zinc-800 my-1" />
            <button onClick={() => { onLogout(); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-400 rounded-xl transition">
              <Car className="w-5 h-5" /><span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NavBar;
