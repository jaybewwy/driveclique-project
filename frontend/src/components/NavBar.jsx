import { Car, Search, Bell, User, Home, Users, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNotifications } from "../hooks/useNotifications";
import GooeyDock from "./ui/gooey-dock";
import SettingsDropdown from "./ui/settings-dropdown";
import NotificationPanel from "./ui/notification-panel";

const NavBar = ({ user, onLogout, showSearch = true }) => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [bellHovered, setBellHovered] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const notifBellRef = useRef(null);

  const isAuthenticated = !!user;

  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications(isAuthenticated);

  const toggleNotifPanel = () => setShowNotifPanel(p => !p);

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
          {/* Gooey nav dock — visible on sm+ */}
          <GooeyDock
            className="hidden sm:flex"
            items={[
              { icon: Home,   label: "Dashboard",  onClick: () => navigate("/dashboard") },
              { icon: Users,  label: "My Clubs",   onClick: () => navigate("/my-clubs") },
              { icon: Search, label: "Find Clubs", onClick: () => navigate("/find-clubs") },
            ]}
          />

          {/* Notification Bell */}
          <div className="relative" ref={notifBellRef}>
            <motion.div
              onMouseEnter={() => setBellHovered(true)}
              onMouseLeave={() => setBellHovered(false)}
              animate={{ scale: bellHovered ? 1.2 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              {/* Liquid blob — same goo filter as GooeyDock */}
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/40"
                style={{ filter: "url(#goo-nav-filter)" }}
                animate={{ scale: bellHovered ? 1.8 : 1, opacity: bellHovered ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />

              <button
                onClick={toggleNotifPanel}
                className="relative p-2.5 rounded-full bg-background/80 backdrop-blur-xl text-zinc-400 hover:text-white transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </motion.div>

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

          {/* Settings dropdown with gooey motion */}
          <motion.div
            className="relative hidden sm:block"
            onMouseEnter={() => setSettingsHovered(true)}
            onMouseLeave={() => setSettingsHovered(false)}
            animate={{ scale: settingsHovered ? 1.2 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/40"
              style={{ filter: "url(#goo-nav-filter)" }}
              animate={{ scale: settingsHovered ? 1.8 : 1, opacity: settingsHovered ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
            <SettingsDropdown onLogout={onLogout} />
          </motion.div>

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
            <button onClick={() => { navigate("/profile"); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition">
              <User className="w-5 h-5" /><span>Profile</span>
            </button>
            <div className="border-t border-zinc-800 my-1" />
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
