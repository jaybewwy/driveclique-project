import { useState, useEffect } from "react";
import { Home, User, Users, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const Sidebar = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userClubs, setUserClubs] = useState([]);

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
    },
    {
      id: "profile",
      label: "Profile",
      icon: User,
      path: "/profile",
    },
    {
      id: "my-clubs",
      label: "My Clubs",
      icon: Users,
      path: "/my-clubs",
    },
    {
      id: "find-club",
      label: "Find Clubs",
      icon: Search,
      path: "/find-club",
    },
  ];

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  return (
    <div className="w-72 hidden lg:block border-r border-zinc-800 p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      {/* User Info Section */}
      {displayName && (
        <div className="flex items-center gap-3 px-4 py-4 mb-4 bg-zinc-900 rounded-2xl">
          <div className="w-10 h-10 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-full h-full p-2 text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            <p className="text-xs text-zinc-500 truncate">@{user?.username}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <div
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer transition ${
                active ? "bg-zinc-900" : ""
              }`}
            >
              <Icon
                className={`w-6 h-6 ${active ? "text-red-500" : ""}`}
              />
              <span className={`${active ? "font-medium" : ""}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Your Clubs Section */}
      {userClubs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-4 mb-3">
            Your Clubs
          </h3>
          <div className="space-y-1">
            {userClubs.slice(0, 5).map((club) => (
              <div
                key={club._id}
                onClick={() => navigate(`/club/${club._id}`)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-900 rounded-xl cursor-pointer transition"
              >
                <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden bg-zinc-800">
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
                      <span className="text-white font-bold text-sm">
                        {club.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-sm truncate flex-1">{club.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;