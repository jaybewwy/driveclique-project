import { Car, Search, Bell, User, Home, Users, Menu, X, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useNotifications } from "../hooks/useNotifications";

const NavBar = ({ user, onLogout, showSearch = true }) => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const isAuthenticated = !!user;
  const { notifications, unreadCount, markAllRead } = useNotifications(isAuthenticated);

  const toggleNotifPanel = () => {
    setShowNotifPanel(p => !p);
    if (!showNotifPanel && unreadCount > 0) markAllRead();
  };

  const typeIcon = (type) => {
    switch (type) {
      case 'NEW_DRIVE':     return '🚗';
      case 'RSVP_NEW':
      case 'RSVP_UPDATED':  return '✅';
      case 'JOIN_REQUEST':  return '🔔';
      case 'JOIN_ACCEPTED': return '🎉';
      case 'JOIN_REJECTED': return '❌';
      default:              return '📣';
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

        {/* Search Bar */}
        {showSearch && (
          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}>
              <input
                type="text"
                placeholder="Search clubs, drives, or members..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-full py-3 pl-12 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:bg-zinc-900 focus:ring-2 focus:ring-red-500/10 transition-all duration-300"
              />
              <Search className={`absolute left-4 top-3.5 w-5 h-5 transition-colors duration-300 ${searchFocused ? 'text-red-500' : 'text-zinc-500'}`} />
            </div>
          </div>
        )}

        {/* Mobile Search Toggle */}
        <button className="md:hidden p-2 hover:bg-zinc-800 rounded-full transition" onClick={() => {}}>
          <Search className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate("/dashboard")} className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition-all duration-200 hidden sm:block group" title="Dashboard">
            <Home className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>
          <button onClick={() => navigate("/my-clubs")} className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition-all duration-200 hidden sm:block group" title="My Clubs">
            <Users className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={toggleNotifPanel}
              className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition-all duration-200 relative group"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifPanel && (
              <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <span className="font-semibold text-sm">Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition">
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">No notifications yet</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition ${!n.read ? 'bg-zinc-800/20' : ''}`}
                      >
                        <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                        <p className="text-sm text-zinc-300 leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div
            className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer border-2 border-zinc-700/50 hover:border-red-500/50 transition-all duration-300 hover:scale-105"
            onClick={() => navigate("/profile")}
            title="Profile"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
            )}
          </div>

          {/* Logout */}
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-red-400 transition-colors duration-200 hidden sm:block px-3 py-2 hover:bg-red-500/10 rounded-lg">
            Logout
          </button>

          {/* Mobile Menu Toggle */}
          <button className="sm:hidden p-2 hover:bg-zinc-800 rounded-xl transition" onClick={() => setShowMobileMenu(!showMobileMenu)}>
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="sm:hidden fixed inset-0 top-16 bg-black/95 backdrop-blur-xl z-40 animate-in slide-in-from-top-10 duration-200">
          <div className="p-4 space-y-2">
            <button onClick={() => { navigate("/dashboard"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition">
              <Home className="w-5 h-5" /><span>Dashboard</span>
            </button>
            <button onClick={() => { navigate("/my-clubs"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition">
              <Users className="w-5 h-5" /><span>My Clubs</span>
            </button>
            <button onClick={() => { onLogout(); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-400 rounded-xl transition">
              <Car className="w-5 h-5" /><span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NavBar;
