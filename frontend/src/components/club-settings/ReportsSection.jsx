import { Car, User } from "lucide-react";
import { useClubReports } from "../../hooks/useClubReports";
import { formatDriveDate } from "../../lib/dateUtils";
import { reportReasonLabel } from "../../lib/reportReasons";
import { SettingsPanel } from "./SettingsPanel";

const TABS = [
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
];

// The queue only ever holds reports on drives and members; a report on the
// club itself isn't sent to the club's own leaders.
const TARGET_TYPES = {
  drive: { label: "Drive", icon: Car },
  user: { label: "Member", icon: User },
};

const actionButtonClass =
  "px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

// A moment in the viewer's own time, e.g. "Oct 6, 2026, 3:04 PM"
const formatWhen = (date) =>
  new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// "you", "@username", or a placeholder once the account is gone
const personLabel = (person, currentUserId) => {
  if (!person) return "a deleted account";
  return person._id === currentUserId ? "you" : `@${person.username}`;
};

/**
 * What has become of the reported drive or member since. `report.target` is
 * its current state (null once deleted); `report.targetLabel` is the name it
 * was reported under.
 */
const targetNotes = ({ targetType, target, targetLabel }) => {
  if (targetType === "drive") {
    if (!target) return ["This drive has since been deleted"];
    return [
      formatDriveDate(target),
      target.isCancelled && "Cancelled",
      target.name !== targetLabel && `Now called "${target.name}"`,
    ].filter(Boolean);
  }
  if (!target) return ["This account has since been deleted"];
  return [
    !target.isMember && "No longer a member of this club",
    `@${target.username}` !== targetLabel && `Now @${target.username}`,
  ].filter(Boolean);
};

const ReportCard = ({ report, currentUserId, busy, onReview }) => {
  const { label, icon: Icon } = TARGET_TYPES[report.targetType];
  const notes = targetNotes(report);

  return (
    <li className={`bg-zinc-900 rounded-xl p-4 transition-opacity ${busy ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex items-start gap-3 min-w-0">
          <Icon size={18} className="mt-0.5 flex-shrink-0 text-zinc-400" />
          <div className="min-w-0">
            <p className="font-medium break-words">
              <span className="font-normal text-zinc-400">{label}: </span>
              {report.targetLabel}
            </p>
            {notes.length > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">{notes.join(" · ")}</p>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1">
          {reportReasonLabel(report.reason)}
        </span>
      </div>

      {report.details && (
        <p className="text-sm text-zinc-300 bg-black rounded-lg px-3 py-2 mt-3 whitespace-pre-wrap break-words">
          {report.details}
        </p>
      )}

      <p className="text-xs text-zinc-400 mt-3">
        Reported by {personLabel(report.reporter, currentUserId)} on {formatWhen(report.reportedAt)}
      </p>

      {report.status === "open" ? (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => onReview(report, "resolved")}
            disabled={busy}
            className={`bg-red-600 hover:bg-red-700 ${actionButtonClass}`}
          >
            Resolve
          </button>
          <button
            type="button"
            onClick={() => onReview(report, "dismissed")}
            disabled={busy}
            className={`bg-zinc-800 hover:bg-zinc-700 ${actionButtonClass}`}
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <p className="text-xs text-zinc-400">
            {report.status === "resolved" ? "Resolved" : "Dismissed"} by{" "}
            {personLabel(report.reviewedBy, currentUserId)} on {formatWhen(report.reviewedAt)}
          </p>
          <button
            type="button"
            onClick={() => onReview(report, "open")}
            disabled={busy}
            className={`bg-zinc-800 hover:bg-zinc-700 ${actionButtonClass}`}
          >
            Reopen
          </button>
        </div>
      )}
    </li>
  );
};

/**
 * Club Settings → Reports (UC-42): the club's review queue. Open to
 * co-leaders as well as the leader; the server leaves out any report made
 * against the person viewing it.
 */
const ReportsSection = ({ club, currentUserId }) => {
  const {
    tab, showTab, page, setPage, loading, loadFailed, retry,
    reports, pagination, openCount, busyId, message, review,
  } = useClubReports(club._id);

  return (
    <SettingsPanel
      title="Reports"
      description="Reports on this club's drives and members. The leader and co-leaders can resolve a report once it has been dealt with, or dismiss it if nothing needs doing."
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
        <div role="group" aria-label="Reports to show" className="flex items-center gap-1 bg-zinc-900 rounded-xl p-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => showTab(id)}
              aria-pressed={tab === id}
              className={`px-4 py-1.5 rounded-lg text-sm transition ${
                tab === id ? "bg-zinc-700 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
              {id === "open" && openCount > 0 && ` (${openCount})`}
            </button>
          ))}
        </div>
        {/* Always mounted, so screen readers announce the text when it arrives */}
        <p role="status" className={`text-sm ${message?.type === "error" ? "text-red-400" : "text-green-400"}`}>
          {message?.text}
        </p>
      </div>

      {loadFailed && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <p role="alert" className="text-sm text-red-400 mb-3">Couldn't load this club's reports.</p>
          <button type="button" onClick={retry} className={`bg-zinc-800 hover:bg-zinc-700 ${actionButtonClass}`}>
            Try again
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-zinc-400">Loading reports…</p>}

      {!loadFailed && !loading && reports.length === 0 && (
        <p className="text-sm text-zinc-400 bg-zinc-900 rounded-xl p-4">
          {tab === "open" ? "No open reports. New ones appear here." : "No closed reports yet."}
        </p>
      )}

      {!loadFailed && reports.length > 0 && (
        <ul className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report._id}
              report={report}
              currentUserId={currentUserId}
              busy={busyId === report._id}
              onReview={review}
            />
          ))}
        </ul>
      )}

      {!loadFailed && pagination?.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className={`bg-zinc-800 hover:bg-zinc-700 ${actionButtonClass}`}
          >
            Previous
          </button>
          <span className="text-xs text-zinc-400">Page {page} of {pagination.totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasMore}
            className={`bg-zinc-800 hover:bg-zinc-700 ${actionButtonClass}`}
          >
            Next
          </button>
        </div>
      )}
    </SettingsPanel>
  );
};

export default ReportsSection;
