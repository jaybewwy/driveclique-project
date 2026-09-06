import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, X } from "lucide-react";
import NavBar from "../components/NavBar";
import Sidebar from "../components/Sidebar";
import { MobileDrawerButton } from "../components/ui/MobileDrawer";
import { drivesAPI, getErrorMessage } from "../services/api";
import { trackEvent } from "../services/analytics";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const RSVP_OPTIONS = [
  { status: "going", label: "Going", activeClass: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40" },
  { status: "maybe", label: "Maybe", activeClass: "bg-amber-600/20 text-amber-400 border-amber-600/40" },
  { status: "not-going", label: "Not Going", activeClass: "bg-zinc-800 text-zinc-300 border-zinc-600" },
];

const formatDayHeading = (year, month, day) =>
  new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const Calendar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpLoadingId, setRsvpLoadingId] = useState(null);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const [highlightedDay, setHighlightedDay] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const dayGroupRefs = useRef({});

  const fetchMonth = useCallback(() => {
    setLoading(true);
    setError("");
    drivesAPI.getCalendar(year, month)
      .then((res) => { if (res.data.success) setDrives(res.data.drives); })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  const goPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };

  // Group drives by day-of-month — used both by the calendar grid (dots +
  // hover tooltips) and the main list (one card per day, chronological).
  const drivesByDay = {};
  drives.forEach((d) => {
    const day = new Date(d.date).getDate();
    (drivesByDay[day] ||= []).push(d);
  });
  const sortedDaysWithDrives = Object.keys(drivesByDay).map(Number).sort((a, b) => a - b);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const calendarCells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day) =>
    day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

  const handleRsvp = async (driveId, status) => {
    setRsvpLoadingId(driveId);
    setError("");
    // Optimistic update, corrected right after via a fresh fetch — a full drive
    // may waitlist instead of applying "going" as-is (see rsvpToDrive's capacity
    // path), so the requested status isn't always the one that actually lands.
    setDrives((prev) => prev.map((d) => (d._id === driveId ? { ...d, myRsvpStatus: status } : d)));
    try {
      await drivesAPI.rsvp(driveId, status);
      trackEvent('RSVP_SUBMITTED', { driveId, status });
      const statusRes = await drivesAPI.getRSVPStatus(driveId);
      if (statusRes.data.success) {
        setDrives((prev) => prev.map((d) => (d._id === driveId ? { ...d, myRsvpStatus: statusRes.data.userStatus } : d)));
      }
    } catch (err) {
      setError(getErrorMessage(err));
      fetchMonth(); // re-sync with the server in case the optimistic update was wrong
    } finally {
      setRsvpLoadingId(null);
    }
  };

  // Clicking a day on the calendar (the touch-friendly equivalent of hovering
  // it on desktop) jumps to and briefly highlights that day's group in the list.
  const handleDayClick = (day) => {
    setMobileCalendarOpen(false);
    const el = dayGroupRefs.current[day];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedDay(day);
      setTimeout(() => setHighlightedDay((d) => (d === day ? null : d)), 2000);
    }
  };

  const calendarGrid = (
    <>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={goPrevMonth} aria-label="Previous month" className="p-1.5 hover:bg-white/[0.06] rounded-lg transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium">{MONTH_NAMES[month - 1]} {year}</span>
        <button type="button" onClick={goNextMonth} aria-label="Next month" className="p-1.5 hover:bg-white/[0.06] rounded-lg transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <button type="button" onClick={goToday} className="btn-ghost w-full mb-3 text-xs py-1.5">
        Today
      </button>

      <div className="grid grid-cols-7 mb-1">
        {DAY_INITIALS.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[10px] font-medium text-zinc-400 py-1">{d}</div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {calendarCells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="aspect-square" />;
            const dayDrives = drivesByDay[day] || [];
            const hasDrives = dayDrives.length > 0;
            return (
              <button
                key={day}
                type="button"
                onClick={() => hasDrives && handleDayClick(day)}
                onMouseEnter={() => hasDrives && setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay((d) => (d === day ? null : d))}
                onFocus={() => hasDrives && setHoveredDay(day)}
                onBlur={() => setHoveredDay((d) => (d === day ? null : d))}
                aria-label={`${MONTH_NAMES[month - 1]} ${day}${hasDrives ? `, ${dayDrives.length} drive${dayDrives.length > 1 ? "s" : ""}` : ""}`}
                className={`relative w-full aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all duration-150 ${
                  isToday(day) ? "border border-red-600/50 text-white" : "text-zinc-300"
                } ${hasDrives ? (hoveredDay === day ? "bg-white/[0.10]" : "hover:bg-white/[0.08] cursor-pointer") : "cursor-default"}`}
              >
                {day}
                {hasDrives && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Hover/focus preview (desktop) — the day button above is also clickable,
          which jumps to and highlights the same drive in the main list, so touch
          devices (which can't hover) get an equivalent path to this info. */}
      <div className="mt-3 pt-3 border-t border-white/[0.07] min-h-[76px]">
        {hoveredDay && drivesByDay[hoveredDay] ? (
          <div className="space-y-2.5">
            {drivesByDay[hoveredDay].map((d) => (
              <div key={d._id}>
                <p className="text-[10px] text-zinc-400 truncate">{d.club.name}</p>
                <p className="text-xs font-semibold text-white truncate">{d.name}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {formatDayHeading(year, month, hoveredDay)}{d.time ? ` · ${d.time}` : ""}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">{d.location}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 text-center py-4">Hover a highlighted day to preview its drives.</p>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} showSearch={false} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main content: flat chronological list of the month's drives */}
        <div id="main-content" role="main" className="flex-1 min-w-0 min-h-screen p-5 md:p-6">
          <div className="mb-6">
            <p className="section-label mb-1.5">Schedule</p>
            <h1 className="text-2xl font-bold text-white">Drives in {MONTH_NAMES[month - 1]} {year}</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/30 border border-red-600 text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-3xl skeleton" />)}
            </div>
          ) : sortedDaysWithDrives.length === 0 ? (
            <div className="glass-card rounded-3xl py-16 text-center">
              <CalendarIcon className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No drives this month. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDaysWithDrives.map((day) => (
                <div
                  key={day}
                  ref={(el) => { dayGroupRefs.current[day] = el; }}
                  className={`glass-card rounded-3xl p-5 transition-shadow duration-300 ${highlightedDay === day ? "ring-2 ring-red-500" : ""}`}
                >
                  <h2 className="text-sm font-semibold text-white mb-4">{formatDayHeading(year, month, day)}</h2>
                  <div className="space-y-4">
                    {drivesByDay[day].map((drive) => (
                      <div key={drive._id} className="border-b border-white/[0.07] pb-4 last:border-b-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/club/${drive.club._id}`)}
                          className="text-left w-full group min-w-0"
                        >
                          <p className="text-xs text-zinc-400 mb-0.5 truncate">{drive.club.name}</p>
                          <p className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                            {drive.name}
                          </p>
                        </button>

                        <div className="mt-1.5 space-y-1">
                          {drive.time && (
                            <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              {drive.time}
                            </p>
                          )}
                          <p className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate min-w-0">{drive.location}</span>
                          </p>
                        </div>

                        {drive.isCompleted ? (
                          <span className="inline-block mt-2.5 text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Completed
                          </span>
                        ) : (
                          <>
                            <div className="flex gap-1.5 mt-2.5 max-w-sm">
                              {RSVP_OPTIONS.map(({ status, label, activeClass }) => (
                                <button
                                  key={status}
                                  type="button"
                                  disabled={rsvpLoadingId === drive._id}
                                  onClick={() => handleRsvp(drive._id, status)}
                                  className={`flex-1 text-[11px] font-medium px-2 py-1.5 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                    drive.myRsvpStatus === status
                                      ? activeClass
                                      : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-white"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            {drive.myRsvpStatus === "waitlisted" && (
                              <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-sky-600/20 text-sky-400 border border-sky-600/40">
                                Waitlisted
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: the calendar widget itself */}
        <MobileDrawerButton onClick={() => setMobileCalendarOpen(true)} breakpointClass="xl:hidden" side="right" label="calendar" />

        <div
          className={
            mobileCalendarOpen
              ? "flex fixed inset-0 z-50 bg-zinc-950 flex-col p-5 pt-[calc(4rem+var(--sat))] overflow-y-auto gap-5 xl:inset-auto xl:z-auto xl:bg-transparent xl:w-72 xl:pt-5 xl:sticky xl:top-[49px] xl:h-[calc(100vh-49px)]"
              : "hidden xl:flex xl:flex-col xl:w-72 xl:p-5 xl:sticky xl:top-[49px] xl:h-[calc(100vh-49px)] xl:overflow-y-auto xl:gap-5"
          }
        >
          {mobileCalendarOpen && (
            <button
              type="button"
              onClick={() => setMobileCalendarOpen(false)}
              aria-label="Close calendar"
              className="xl:hidden absolute top-[calc(1rem+var(--sat))] right-4 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="glass-card rounded-3xl p-4">
            <p className="section-label mb-3">Calendar</p>
            {calendarGrid}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
