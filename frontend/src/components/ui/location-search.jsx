import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Country detection singleton ────────────────────────────────────────────
//
// At most one network call per browser session.
// Result is cached in sessionStorage ('dc_country') so navigating between
// pages does not re-fetch.  A module-level promise ensures that multiple
// LocationSearch instances mounted at the same time share a single in-flight
// request rather than each firing their own.

let _detectionPromise = null;

function detectCountry() {
  // Return an already-running/resolved promise if it exists
  if (_detectionPromise) return _detectionPromise;

  // Pull from sessionStorage cache first
  const cached = sessionStorage.getItem('dc_country');
  if (cached) {
    _detectionPromise = Promise.resolve(cached);
    return _detectionPromise;
  }

  // Race the IP lookup against a 4-second timeout so slow responses
  // don't block the UI — fall back to unrestricted search.
  _detectionPromise = Promise.race([
    fetch('https://ipapi.co/json/', { headers: { Accept: 'application/json' } })
      .then(r => r.json())
      .then(d => {
        const code = d?.country_code?.toLowerCase?.() || '';
        if (code) sessionStorage.setItem('dc_country', code);
        return code;
      }),
    new Promise(resolve => setTimeout(() => resolve(''), 4000)),
  ]).catch(() => '');

  return _detectionPromise;
}

// Convert ISO 3166-1 alpha-2 code → English country name using native Intl API.
// Returns null when the runtime doesn't support Intl.DisplayNames.
function isoToCountryName(code) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase());
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * LocationSearch — debounced city/country autocomplete backed by
 * OpenStreetMap Nominatim (free, no API key required).
 *
 * Results are automatically restricted to the user's country via IP
 * geolocation (cached in sessionStorage after the first call).
 *
 * Props
 *   value       string           — controlled value
 *   onChange    (string) => void — called on keystroke and on selection
 *   countryCode string           — optional ISO 3166-1 alpha-2 override (e.g. 'us')
 *                                  bypasses auto-detection when provided
 */
export function LocationSearch({ value, onChange, countryCode: propCountryCode }) {
  const [query, setQuery]             = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [searching, setSearching]     = useState(false);
  const [noResults, setNoResults]     = useState(false);
  const [activeCountry, setActiveCountry] = useState(''); // resolved ISO code in use
  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  // Sync if parent resets the value (e.g. form clear)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Resolve which country code to use: explicit prop > auto-detection
  useEffect(() => {
    if (propCountryCode) {
      setActiveCountry(propCountryCode.toLowerCase());
      return;
    }
    detectCountry().then(code => {
      if (code) setActiveCountry(code);
    });
  }, [propCountryCode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const runSearch = async (val) => {
    setSearching(true);
    setNoResults(false);
    try {
      // Append countrycodes param only when a country has been resolved
      const countryParam = activeCountry ? `&countrycodes=${activeCountry}` : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(val)}` +
        `&format=json&limit=10&addressdetails=1` +
        countryParam,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();

      const seen = new Set();
      const results = data
        .map(r => {
          const city    = r.address?.city || r.address?.town || r.address?.village
                        || r.address?.suburb || r.address?.county || r.name;
          const state   = r.address?.state;
          const country = r.address?.country;
          if (!city || !country) return null;
          return [city, state, country].filter(Boolean).join(', ');
        })
        .filter(label => {
          if (!label || seen.has(label)) return false;
          seen.add(label);
          return true;
        })
        .slice(0, 6);

      setSuggestions(results);
      setNoResults(results.length === 0);
      setOpen(true);
    } catch {
      setSuggestions([]);
      setNoResults(false);
      setOpen(false);
    } finally {
      setSearching(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setSuggestions([]);
      setNoResults(false);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  const handleSelect = (label) => {
    setQuery(label);
    onChange(label);
    setOpen(false);
    setSuggestions([]);
    setNoResults(false);
  };

  const countryName = isoToCountryName(activeCountry);
  const placeholder = countryName
    ? `Search city in ${countryName}…`
    : 'Search city or region…';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className={cn(
        "flex items-center w-full bg-white/[0.06] border border-white/[0.10] h-11 rounded-2xl overflow-hidden px-4 gap-3",
        "focus-within:border-red-500/60 focus-within:bg-white/[0.09] focus-within:ring-1 focus-within:ring-red-500/20 transition-all duration-200"
      )}>
        <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
        />
        {searching && (
          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin shrink-0" />
        )}
      </div>

      {/* Country indicator badge */}
      {activeCountry && !searching && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {!searching && query.length === 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-md text-[10px] text-zinc-500">
              <Globe className="w-2.5 h-2.5" />
              {activeCountry.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-glass-lg">
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((label) => (
                <li key={label}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(label)}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                    {label}
                  </button>
                </li>
              ))}
              {countryName && (
                <li className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-zinc-600" />
                  <span className="text-[11px] text-zinc-600">Showing results in {countryName}</span>
                </li>
              )}
            </>
          ) : noResults ? (
            <li className="px-4 py-3 text-sm text-zinc-500 text-center">
              {countryName
                ? `No locations found in ${countryName} — try a different city name`
                : 'No locations found — try a different city name'}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
