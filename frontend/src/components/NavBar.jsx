import { Car, Search, Bell, User, Home, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NavBar = ({ user, onLogout, showSearch = true }) => {
  const navigate = useNavigate();

  return (
    <nav className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div 
          className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          <Car className="w-6 h-6" />
        </div>
        <h1 
          className="text-2xl font-bold cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          DriveClique
        </h1>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search clubs, drives, or members..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-3 pl-12 text-sm focus:outline-none focus:border-red-600"
            />
            <Search className="absolute left-4 top-3.5 text-zinc-500 w-5 h-5" />
          </div>
        </div>
      )}

      {/* Right Side Actions */}
      <div className="flex items-center gap-6">
        <button 
          onClick={() => navigate("/dashboard")} 
          className="p-3 hover:bg-zinc-900 rounded-full"
          title="Dashboard"
        >
          <Home className="w-6 h-6" />
        </button>
        <button 
          onClick={() => navigate("/my-clubs")} 
          className="p-3 hover:bg-zinc-900 rounded-full"
          title="My Clubs"
        >
          <Users className="w-6 h-6" />
        </button>
        <button 
          className="p-3 hover:bg-zinc-900 rounded-full relative"
          title="Notifications"
        >
          <Bell className="w-6 h-6" />
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">3</span>
        </button>
        <div 
          className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden cursor-pointer border-2 border-zinc-600 hover:border-red-500 transition"
          onClick={() => navigate("/profile")}
          title="Profile"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-full h-full p-1 text-zinc-400" />
          )}
        </div>
        <button
          onClick={onLogout} 
          className="text-sm text-zinc-400 hover:text-red-500"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default NavBar;