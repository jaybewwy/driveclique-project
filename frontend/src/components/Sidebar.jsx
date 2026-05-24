import { Home, User, Users, Search, Calendar, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const Sidebar = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get the display name or fall back to username
  const displayName = user?.useDisplayName && user?.name ? user.name : user?.username;

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
      label: "Find A Club",
      icon: Search,
      path: "/find-club",
    },
    {
      id: "upcoming-drives",
      label: "Upcoming Drives",
      icon: Calendar,
      path: "/drives", // TODO: Create drives page
    },
    {
      id: "create-drive",
      label: "Create Drive",
      icon: Plus,
      path: "/create-drive", // TODO: Create drive creation page
    },
  ];

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  return (
    <div className="w-72 hidden lg:block border-r border-zinc-800 p-4 sticky top-16 h-screen overflow-y-auto">
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
    </div>
  );
};

export default Sidebar;