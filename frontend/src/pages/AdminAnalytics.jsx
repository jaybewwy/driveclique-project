import { useEffect, useState } from "react";
import { ShieldAlert, BarChart3, Users, Eye } from "lucide-react";
import NavBar from "../components/NavBar";
import { getAdminAnalyticsSummary } from "../services/analytics";

const EVENT_LABELS = {
  PAGE_VIEW:        "Page Views",
  CLUB_CREATED:     "Clubs Created",
  CLUB_JOINED:      "Clubs Joined",
  DRIVE_SCHEDULED:  "Drives Scheduled",
  RSVP_SUBMITTED:   "RSVPs Submitted",
  RATING_SUBMITTED: "Ratings Given",
  REPORT_SUBMITTED: "Reports Filed",
};

const AdminAnalytics = ({ user, onLogout }) => {
  const [state, setState] = useState("loading"); // 'loading' | 'denied' | 'ready'
  const [data, setData] = useState(null);

  useEffect(() => {
    getAdminAnalyticsSummary()
      .then((res) => {
        if (res.data?.success) {
          setData(res.data);
          setState("ready");
        } else {
          setState("denied");
        }
      })
      .catch(() => setState("denied"));
  }, []);

  return (
    <div id="main-content" role="main" className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} showSearch={false} />

      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Product Analytics</h1>
            <p className="text-zinc-400 text-sm">Aggregate event activity across all users</p>
          </div>
        </div>

        {state === "loading" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-5 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {state === "denied" && (
          <div className="glass-card p-10 text-center">
            <div className="w-14 h-14 bg-red-500/15 border border-red-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-white font-semibold mb-1">You don't have access to this page</p>
            <p className="text-zinc-400 text-sm">This dashboard is restricted to authorized accounts.</p>
          </div>
        )}

        {state === "ready" && (
          <div className="space-y-8">
            {/* Active users */}
            <div className="glass-card p-5 flex items-center gap-4 max-w-xs">
              <div className="w-10 h-10 bg-sky-500/15 border border-sky-500/25 rounded-xl flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.activeUsers30d}</p>
                <p className="text-xs text-zinc-400">Active Users (30d)</p>
              </div>
            </div>

            {/* Totals by type */}
            <div>
              <p className="section-label mb-3">Total Events by Type</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(EVENT_LABELS).map(([type, label]) => (
                  <div key={type} className="glass-card p-5">
                    <p className="text-2xl font-bold">{data.totals[type] ?? 0}</p>
                    <p className="text-xs text-zinc-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily page views */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-zinc-400" />
                <p className="section-label">Page Views — Last 14 Days</p>
              </div>
              {data.dailyPageViews.length === 0 ? (
                <p className="text-zinc-400 text-sm">No page views recorded yet.</p>
              ) : (
                <div className="glass-card p-5 space-y-2">
                  {data.dailyPageViews.map(({ date, count }) => (
                    <div key={date} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-24 shrink-0">{date}</span>
                      <div className="flex-1 bg-white/[0.04] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-600 to-orange-600"
                          style={{ width: `${Math.min(100, count * 4)}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
