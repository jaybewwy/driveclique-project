import { Car, Search, Bell, User, Home, Users, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const NavBar = ({ user, onLogout, showSearch = true }) => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

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
              {searchFocused && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 -z-10 blur-xl" />
              )}
            </div>
          </div>
        )}

        {/* Mobile Search Toggle */}
        <button 
          className="md:hidden p-2 hover:bg-zinc-800 rounded-full transition"
          onClick={() => {}}
        >
          <Search className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => navigate("/dashboard")} 
            className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition-all duration-200 hidden sm:block group"
            title="Dashboard"
          >
            <Home className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>
          <button 
            onClick={() => navigate("/my-clubs")} 
            className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition-all duration-200 hidden sm:block group"
            title="My Clubs"
          >
            <Users className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>
          <button 
            className="p-2.5 hover:bg-zinc-800/50 rounded-xl transition-all duration-200 relative group"
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75" />
          </button>
          
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
          <button
            onClick={onLogout} 
            className="text-sm text-zinc-400 hover:text-red-400 transition-colors duration-200 hidden sm:block px-3 py-2 hover:bg-red-500/10 rounded-lg"
          >
            Logout
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            className="sm:hidden p-2 hover:bg-zinc-800 rounded-xl transition"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="sm:hidden fixed inset-0 top-16 bg-black/95 backdrop-blur-xl z-40 animate-in slide-in-from-top-10 duration-200">
          <div className="p-4 space-y-2">
            <button 
              onClick={() => { navigate("/dashboard"); setShowMobileMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition"
            >
              <Home className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => { navigate("/my-clubs"); setShowMobileMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl transition"
            >
              <Users className="w-5 h-5" />
              <span>My Clubs</span>
            </button>
            <button 
              onClick={() => { onLogout(); setShowMobileMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-400 rounded-xl transition"
            >
              <Car className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NavBar;