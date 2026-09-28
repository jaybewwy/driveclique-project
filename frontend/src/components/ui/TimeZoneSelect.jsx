import { useMemo } from "react";

// Every IANA zone the browser knows, computed once per page load
let zoneList = null;
const getZoneList = () => {
  if (!zoneList) {
    try {
      zoneList = Intl.supportedValuesOf("timeZone");
    } catch {
      zoneList = [];
    }
  }
  return zoneList;
};

/**
 * TimeZoneSelect — picks the IANA zone a drive takes place in.
 *
 * The browser's own zone can be an alias that isn't in the canonical list
 * (Chrome reports "Asia/Calcutta" but lists "Asia/Kolkata"), and some
 * browsers leave out "UTC", so the current value is always included.
 *
 * Props
 *   id         string            — for the caller's <label htmlFor>
 *   value      string            — IANA zone, e.g. "America/Los_Angeles"
 *   onChange   (string) => void
 *   className  string
 */
export function TimeZoneSelect({ id, value, onChange, className }) {
  const options = useMemo(() => {
    const zones = getZoneList();
    return zones.includes(value) ? zones : [value, ...zones];
  }, [value]);

  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {options.map((zone) => (
        <option key={zone} value={zone} className="bg-zinc-900">
          {zone.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
