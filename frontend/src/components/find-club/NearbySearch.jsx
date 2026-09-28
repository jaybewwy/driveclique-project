import { Calendar, LocateFixed, Navigation } from "lucide-react";
import { LocationSearch } from "../ui/location-search";
import { formatDriveDate, formatDriveTimeLabel } from "../../lib/dateUtils";
import { RADIUS_OPTIONS } from "../../hooks/useNearbySearch";

/**
 * "Search near" controls (UC-46): use my location, pick a city, radius.
 * `search` is useNearbySearch()'s result.
 */
export const SearchNearPanel = ({ search }) => (
  // relative z-20: backdrop-blur makes this a stacking context, and without
  // it the city dropdown would paint underneath the (also blurred) result
  // cards that follow.
  <div className="relative z-20 mb-5 glass-subtle rounded-2xl p-4">
    <div className="flex items-center justify-between gap-2 mb-3">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Navigation className="w-4 h-4 text-red-400" /> Search near
      </p>
      {search.near && (
        <button
          type="button"
          onClick={search.clear}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Clear distance filter
        </button>
      )}
    </div>
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        type="button"
        onClick={search.locateMe}
        disabled={search.locating}
        className="btn-ghost h-11 px-4 text-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <LocateFixed className="w-4 h-4" /> {search.locating ? "Locating…" : "Use my location"}
      </button>
      <div className="flex-1 min-w-0">
        <label htmlFor="find-club-near" className="sr-only">City to search near</label>
        <LocationSearch
          id="find-club-near"
          value={search.nearQuery}
          onChange={search.setNearQuery}
          onSelect={search.pickPlace}
        />
      </div>
      <label htmlFor="find-club-radius" className="sr-only">Search radius</label>
      <select
        id="find-club-radius"
        value={search.radius}
        onChange={(e) => search.setRadius(Number(e.target.value))}
        className="h-11 bg-white/[0.06] border border-white/[0.10] rounded-2xl px-3 text-sm text-white focus:outline-none focus:border-red-500/40 shrink-0"
      >
        {RADIUS_OPTIONS.map((miles) => (
          <option key={miles} value={miles} className="bg-zinc-900">Within {miles} mi</option>
        ))}
      </select>
    </div>
    {search.locationError && <p className="text-xs text-red-400 mt-2">{search.locationError}</p>}
    {search.near && (
      <p className="text-xs text-zinc-400 mt-2">
        Clubs within {search.radius} mi of {search.near.label}, nearest first. Clubs without a pinned location aren't included.
      </p>
    )}
  </div>
);

/** Upcoming drives within the search radius; `drives` is null while loading */
export const NearbyDrivesSection = ({ radius, drives, onOpenClub }) => (
  <section aria-labelledby="nearby-drives-heading" className="mb-6">
    <h2 id="nearby-drives-heading" className="section-label mb-3">
      Upcoming drives within {radius} mi
    </h2>
    {drives === null ? (
      <p className="text-sm text-zinc-400">Looking for drives…</p>
    ) : drives.length === 0 ? (
      <p className="text-sm text-zinc-400 glass-subtle rounded-2xl p-4">
        No upcoming drives with a meeting-point pin in this area yet.
      </p>
    ) : (
      <ul className="grid sm:grid-cols-2 gap-3">
        {drives.map((drive) => (
          <li key={drive._id}>
            <button
              type="button"
              onClick={() => onOpenClub(drive.club._id)}
              className="w-full text-left glass-card p-4 rounded-2xl hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200"
            >
              <p className="font-semibold text-white truncate">{drive.name}</p>
              <p className="text-xs text-zinc-400 truncate mb-2">{drive.club.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDriveDate(drive, { weekday: "short", month: "short", day: "numeric" })}
                  {drive.time ? ` · ${formatDriveTimeLabel(drive)}` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" /> {drive.distanceMiles} mi away
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);
