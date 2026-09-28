import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, ChevronDown, ChevronRight, Home, User as UserIcon, Users } from "lucide-react";
import { MobileDrawerButton, MobileDrawer } from "../ui/MobileDrawer";
import { displayName as displayNameOf } from "../../lib/userDisplay";

const SidebarSectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-3 mb-2">{children}</p>
);

const SidebarNavItem = ({ icon: Icon, label, active, onClick }) => (
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
  </button>
);

/**
 * Settings page navigation: app links, the three settings views
 * ("profile", "personal", "clubs"), and the user card. A drawer below xl.
 */
const SettingsSidebar = ({ user, activeView, onViewChange }) => {
  const navigate = useNavigate();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = displayNameOf(user);

  const goTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const onViewChangeAndClose = (view) => {
    onViewChange(view);
    setMobileOpen(false);
  };

  const content = (
    <>
      <div className="flex-1 overflow-y-auto space-y-6">
        <div>
          <SidebarSectionLabel>Main</SidebarSectionLabel>
          <div className="space-y-1">
            <SidebarNavItem icon={Home} label="Home" onClick={() => goTo("/dashboard")} />
            <SidebarNavItem
              icon={UserIcon}
              label="Profile"
              active={activeView === "profile"}
              onClick={() => onViewChangeAndClose("profile")}
            />
            <SidebarNavItem icon={Users} label="My Clubs" onClick={() => goTo("/my-clubs")} />
          </div>
        </div>

        <div>
          <SidebarSectionLabel>Analytics</SidebarSectionLabel>
          <button
            onClick={() => setAnalyticsOpen(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 transition-all duration-200"
          >
            <BarChart2 className="w-[18px] h-[18px] text-red-400" />
            <span className="text-sm font-medium flex-1 text-left">Menu Level</span>
            {analyticsOpen
              ? <ChevronDown className="w-4 h-4 text-zinc-400" />
              : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>

          {analyticsOpen && (
            <div className="mt-1 ml-3 pl-3 border-l border-zinc-800/60 space-y-1">
              <SidebarNavItem
                icon={UserIcon}
                label="Personal"
                active={activeView === "personal"}
                onClick={() => onViewChangeAndClose("personal")}
              />
              <SidebarNavItem
                icon={Users}
                label="Clubs"
                active={activeView === "clubs"}
                onClick={() => onViewChangeAndClose("clubs")}
              />
            </div>
          )}
        </div>
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
                  <UserIcon className="w-4 h-4 text-zinc-400" />
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
      <nav aria-label="Settings navigation" className="w-60 xl:w-64 2xl:w-72 flex-none hidden xl:flex flex-col border-r border-zinc-800/50 p-3 xl:p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden bg-black/20">
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

export default SettingsSidebar;
