import { useState, useEffect } from "react";
import { Home, User, Users, Search, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const Sidebar = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userClubs, setUserClubs] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);

  // Get the display name or fall back to username
  const displayName = user?.useDisplayName && user?.name ? user.name : user?.username;

  // Fetch user's clubs
  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://localhost:5000/api/clubs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
          setUserClubs(response.data.clubs);
        }
      } catch (error) {
        console.error("Error fetching clubs:", error);
      }
    };
    fetchClubs();
  }, []);

  const sidebarItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      path: "/dashboard",
      gradient: "from-blue-500/20 to-blue-600/20",
      activeGradient: "from-blue-500/30 to-blue-600/30",
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      path: "/profile",
      gradient: "from-purple-500/20 to-purple-600/20",
      activeGradient: "from-purple-500/30 to-purple-600/30",
    },
    {
      id: "my-clubs",
      label: "My Clubs",
      icon: Users,
      path: "/my-clubs",
      gradient: "from-orange-500/20 to-orange-600/20",
      activeGradient: "from-orange-500/30 to-orange-600/30",
    },
    {
      id: "find-club",
      label: "Find Clubs",
      icon: Search,
      path: "/find-club",
      gradient: "from-green-500/20 to-green-600/20",
      activeGradient: "from-green-500/30 to-green-600/30",
    },
  ];

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  return (
    <div className="w-72 hidden lg:block border-r border-zinc-800/50 p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-black/20">
      {/* User Info Section */}
      {displayName && (
        <div className="relative group mb-6">
          <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 backdrop-blur-sm rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-zinc-700/30 group-hover:ring-red-500/30 transition-all duration-300">
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-white">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate">@{user?.username}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <div className="space-y-1.5 mb-6">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isHovered = hoveredItem === item.id;
          
          return (
            <div
              key={item.id}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 group ${
                active 
                  ? `bg-gradient-to-r ${item.activeGradient} border border-zinc-700/30` 
                  : `hover:bg-zinc-900/50 hover:border border-zinc-800/30`
              }`}
            >
              {active && (
                <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-xl -z-10 blur-sm opacity-50`} />
              )}
              <div className={`relative p-1.5 rounded-lg transition-all duration-300 ${
                active 
                  ? 'bg-zinc-800/50' 
                  : isHovered 
                    ? 'bg-zinc-800/30' 
                    : ''
              }`}>
                <Icon
                  className={`w-5 h-5 transition-all duration-300 ${
                    active 
                      ? 'text-white' 
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
              </div>
              <span className={`text-sm transition-all duration-300 ${
                active ? 'font-semibold text-white' : 'text-zinc-400 group-hover:text-zinc-200'
              }`}>
                {item.label}
              </span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="mb-6 p-4 bg-gradient-to-br from-zinc-900/50 to-zinc-900/20 rounded-2xl border border-zinc-800/30">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-3 h-3" />
          Quick Stats
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-zinc-800/30 rounded-lg">
            <p className="text-lg font-bold text-white">{userClubs.length}</p>
            <p className="text-xs text-zinc-500">Clubs</p>
          </div>
          <div className="p-2 bg-zinc-800/30 rounded-lg">
            <p className="text-lg font-bold text-white">12</p>
            <p className="text-xs text-zinc-500">Events</p>
          </div>
        </div>
      </div>

      {/* Your Clubs Section */}
      {userClubs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-4 mb-3 flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            Your Clubs
          </h3>
          <div className="space-y-1">
            {userClubs.slice(0, 5).map((club, index) => (
              <div
                key={club._id}
                onClick={() => navigate(`/club/${club._id}`)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/50 rounded-xl cursor-pointer transition-all duration-200 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden ring-1 ring-zinc-700/30 group-hover:ring-zinc-600/50 transition-all duration-300">
                  {club.avatar ? (
                    <img
                      src={club.avatar}
                      alt={club.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = `https://via.placeholder.com/32?text=${club.name.charAt(0).toUpperCase()}`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">
                        {club.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-sm text-zinc-400 truncate flex-1 group-hover:text-zinc-200 transition-colors">
                  {club.name}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Card */}
      <div className="relative overflow-hidden p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-2xl border border-red-500/20">
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-400" />
          Premium
        </h3>
        <p className="text-xs text-zinc-400 mb-3">
          Unlock exclusive features and analytics
        </p>
        <button className="w-full py-2 px-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-medium rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25">
          Upgrade Now
        </button>
      </div>
    </div>
  );
};

export default Sidebar;