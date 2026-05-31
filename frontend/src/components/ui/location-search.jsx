import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LocationSearch — debounced city/country autocomplete backed by
 * OpenStreetMap Nominatim (free, no API key required).
 *
 * Props
 *   value     string           — controlled value (displayed in the input)
 *   onChange  (string) => void — called on every keystroke AND on selection
 */
export function LocationSearch({ value, onChange }) {
  const [query, setQuery]             = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [searching, setSearching]     = useState(false);
  const [noResults, setNoResults]     = useState(false);
  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  // Sync if parent resets the value (e.g. form clear)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

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
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(val)}` +
        `&format=json&limit=10&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();

      // Accept every result that resolves to a city + country.
      // No class/type filter — many major cities (New York, Lagos, Nairobi…)
      // are tagged class:'boundary' and would be silently dropped otherwise.
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

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className={cn(
        "flex items-center w-full bg-transparent border border-zinc-700 h-12 rounded-2xl overflow-hidden pl-5 gap-3",
        "focus-within:border-red-500 transition-colors duration-200"
      )}>
        <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search city or region..."
          autoComplete="off"
          className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full"
        />
        {searching && (
          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin shrink-0 mr-4" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
          {suggestions.length > 0 ? (
            suggestions.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(label)}
                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                  {label}
                </button>
              </li>
            ))
          ) : noResults ? (
            <li className="px-4 py-3 text-sm text-zinc-500 text-center">
              No locations found — try a different city name
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
