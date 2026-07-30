import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Calendar, CheckCircle, Users, UserCheck, UserX,
  Clock, Megaphone, CheckCheck, MapPin, Shield, ShieldOff,
} from "lucide-react";

// Map SSE event types to lucide icons and accent colours
const TYPE_META = {
  NEW_DRIVE:            { icon: Calendar,     color: "text-red-400"    },
  RSVP_NEW:             { icon: CheckCircle,  color: "text-green-400"  },
  RSVP_UPDATED:         { icon: CheckCircle,  color: "text-green-400"  },
  JOIN_REQUEST:         { icon: Users,        color: "text-blue-400"   },
  JOIN_ACCEPTED:        { icon: UserCheck,    color: "text-green-400"  },
  JOIN_REJECTED:        { icon: UserX,        color: "text-red-400"    },
  NEW_ANNOUNCEMENT:     { icon: Megaphone,    color: "text-orange-400" },
  WAITLIST_JOINED:      { icon: Clock,        color: "text-amber-400"  },
  WAITLIST_PROMOTED:    { icon: CheckCircle,  color: "text-emerald-400"},
  DRIVE_CHECKIN_REQUEST:{ icon: MapPin,       color: "text-sky-400"    },
  COLEADER_PROMOTED:    { icon: Shield,       color: "text-sky-400"    },
  COLEADER_DEMOTED:     { icon: ShieldOff,    color: "text-amber-400"  },
};

const relativeTime = (createdAt) => {
  const diff = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const NotificationPanel = ({ notifications, unreadCount, markAllRead, markOneRead, onClose, excludeRef }) => {
  const [tab, setTab] = useState("all");
  const ref = useRef(null);
  const navigate = useNavigate();

  const handleClick = (n) => {
    markOneRead(n.id);
    if (n.type === "DRIVE_CHECKIN_REQUEST" && n.data?.driveId) {
      navigate(`/drive/${n.data.driveId}/checkin`);
      onClose();
    }
  };

  useEffect(() => {
    const handle = (e) => {
      const insidePanel  = ref.current?.contains(e.target);
      const insideBell   = excludeRef?.current?.contains(e.target);
      if (!insidePanel && !insideBell) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, excludeRef]);

  const filtered = tab === "unread"
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 w-96 bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-glass-lg z-50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-800/60 rounded-xl p-0.5">
          {["all", "unread"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                tab === t
                  ? "bg-zinc-700 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "all" ? "All" : "Unread"}
              {t === "unread" && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Bell className="w-8 h-8 text-zinc-700" />
            <p className="text-zinc-400 text-sm">
              {tab === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          filtered.map(n => {
            const meta = TYPE_META[n.type] || { icon: Bell, color: "text-zinc-400" };
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-zinc-800/50 text-left hover:bg-zinc-800/40 transition-colors ${
                  !n.read ? "bg-zinc-800/20" : ""
                }`}
              >
                {/* Type icon */}
                <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>
                  <Icon size={16} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.read ? "text-zinc-100 font-medium" : "text-zinc-400"}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{relativeTime(n.createdAt)}</p>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-zinc-800 text-center">
        <button className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors">
          View all notifications
        </button>
      </div>
    </div>
  );
};

export default NotificationPanel;
