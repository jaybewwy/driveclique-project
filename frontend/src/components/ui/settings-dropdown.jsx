import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, User, Users, LogOut } from "lucide-react";

const MENU_ITEMS = [
  { icon: User,     label: "Profile", action: "profile" },
  { icon: Users,    label: "Clubs",   action: "clubs"   },
  { icon: Settings, label: "Settings",action: "settings" },
];

const SettingsDropdown = ({ onLogout }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleAction = (action) => {
    setOpen(false);
    switch (action) {
      case "profile":  return navigate("/profile");
      case "clubs":    return navigate("/my-clubs");
      case "settings": return navigate("/profile");
      case "logout":   return onLogout();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="p-2.5 rounded-xl transition-all duration-200 group"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-52 bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="p-1.5">
            {MENU_ITEMS.map(({ icon: Icon, label, action }) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-xl transition-all duration-150"
              >
                <Icon className="w-4 h-4 text-zinc-400" />
                {label}
              </button>
            ))}

            <div className="my-1.5 border-t border-zinc-800" />

            <button
              onClick={() => handleAction("logout")}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-150"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown;
