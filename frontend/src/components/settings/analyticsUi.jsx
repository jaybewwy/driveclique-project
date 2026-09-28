import { AlertCircle } from "lucide-react";

// Presentational pieces shared by the Personal and Club analytics views

export const AnalyticsHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-8">
    <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl">
      <Icon size={20} />
    </div>
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-zinc-400">{subtitle}</p>
    </div>
  </div>
);

export const ErrorBanner = ({ message }) => (
  <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-2xl p-4 mb-6">
    <AlertCircle size={18} className="text-red-400 shrink-0" />
    <p className="text-sm text-red-300">{message}</p>
  </div>
);

export const StatChip = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-1 hover:border-white/[0.11] transition-all duration-200">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={13} className={accent} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
    <span className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</span>
  </div>
);

export const DetailCard = ({ icon: Icon, label, children, accent = "text-zinc-400" }) => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-2 min-h-[110px] hover:border-white/[0.09] transition-all duration-200">
    <div className="flex items-center gap-1.5">
      <Icon size={13} className={accent} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
    <div className="flex-1 flex flex-col justify-center">{children}</div>
  </div>
);

// Full class names spelled out so Tailwind's scanner keeps them
const RATE_BAR_COLORS = {
  emerald: { text: "text-emerald-400", fill: "from-emerald-500 to-emerald-400" },
  sky: { text: "text-sky-400", fill: "from-sky-500 to-sky-400" },
  purple: { text: "text-purple-400", fill: "from-purple-500 to-purple-400" },
};

/** A labelled 0–100% progress bar */
export const RateBar = ({ label, rate, color }) => {
  const { text, fill } = RATE_BAR_COLORS[color];
  return (
    <div className="mt-2">
      <div className="flex justify-between mb-1.5">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className={`text-[11px] font-semibold ${text}`}>{rate}%</span>
      </div>
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${fill} rounded-full transition-all duration-700`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
};

export const SkeletonAnalyticsCard = () => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 animate-pulse">
    <div className="h-5 bg-white/[0.06] rounded-lg w-48 mb-6" />
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[1, 2, 3].map(i => <div key={i} className="bg-white/[0.04] rounded-2xl p-4 h-20" />)}
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-white/[0.03] rounded-2xl p-4 h-28" />)}
    </div>
  </div>
);

export const SkeletonPersonalCard = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="bg-white/[0.04] rounded-2xl h-20" />)}
    </div>
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-white/[0.05] rounded-xl h-16" />)}
    </div>
  </div>
);

const STATUS_STYLES = {
  going:      "bg-green-500/15 text-green-400 border-green-500/20",
  maybe:      "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  "not-going":"bg-red-500/15 text-red-400 border-red-500/20",
  waitlisted: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

/** An RSVP status as a colored pill */
export const StatusBadge = ({ status }) => (
  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
    {status}
  </span>
);
