/**
 * Geo helpers for the drive meeting-point pin (UC-23) and proximity search (UC-46).
 *
 * Coordinates cross the API as `{ lat, lng }` everywhere — the shape
 * LocationSearch's onSelect and Drive.coordinates already use. Clubs store
 * theirs as a GeoJSON Point so a 2dsphere index can back $geoNear (sorted,
 * paginated, combinable with the text/tag filters). Drives keep their
 * pre-existing `{ lat, lng }` subdocument, so nearby-drive search uses a
 * bounding-box prefilter plus an exact haversine check instead of a schema
 * migration.
 */
const { AppError } = require('../middleware/errorHandler');

const EARTH_RADIUS_MILES = 3958.8;
const METERS_PER_MILE = 1609.344;
const DEFAULT_SEARCH_RADIUS_MILES = 25;
const MAX_SEARCH_RADIUS_MILES = 250;

const toRadians = (deg) => (deg * Math.PI) / 180;
const toDegrees = (rad) => (rad * 180) / Math.PI;

// Shared validation for an optional `{ lat, lng }` pair
function validateCoordinates(coordinates) {
  if (!coordinates) return;
  const { lat, lng } = coordinates;
  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180
  ) {
    throw new AppError('Invalid coordinates', 400);
  }
}

// GeoJSON orders a Point as [longitude, latitude] — the reverse of `{ lat, lng }`
function toGeoPoint({ lat, lng }) {
  return { type: 'Point', coordinates: [lng, lat] };
}

/**
 * Parse the `lat`/`lng`/`radius` query params shared by club browse and
 * nearby drives. Returns null when no search center was given (plain,
 * non-proximity search). validateQuery has already range-checked each value
 * individually; this only enforces that lat and lng arrive together.
 */
function parseProximityQuery({ lat, lng, radius }) {
  // validateQuery skips empty values, so `?lat=` must count as absent here
  // rather than reaching Number('') === 0
  const has = (value) => value !== undefined && value !== '';
  if (!has(lat) && !has(lng)) return null;
  if (!has(lat) || !has(lng)) {
    throw new AppError('lat and lng must be provided together', 400);
  }
  return {
    center: { lat: Number(lat), lng: Number(lng) },
    radiusMiles: has(radius) ? Number(radius) : DEFAULT_SEARCH_RADIUS_MILES,
  };
}

// Great-circle distance between two `{ lat, lng }` points, in miles
function haversineMiles(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Smallest lat/lng box containing the search circle, used as a cheap query
 * prefilter ahead of the exact haversine check. The longitude half-width is
 * asin(sin r / cos lat) rather than the r / cos lat approximation, which
 * undershoots at high latitudes and would drop matches near the circle's
 * edge. minLng/maxLng come back null when the circle covers a pole or wraps
 * the antimeridian — meaning "don't filter on longitude" (still correct,
 * just less selective).
 */
function boundingBox({ lat, lng }, radiusMiles) {
  const angular = radiusMiles / EARTH_RADIUS_MILES;
  const minLat = lat - toDegrees(angular);
  const maxLat = lat + toDegrees(angular);
  if (minLat <= -90 || maxLat >= 90) {
    return { minLat: Math.max(minLat, -90), maxLat: Math.min(maxLat, 90), minLng: null, maxLng: null };
  }

  const lngDelta = toDegrees(Math.asin(Math.sin(angular) / Math.cos(toRadians(lat))));
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  if (minLng < -180 || maxLng > 180) {
    return { minLat, maxLat, minLng: null, maxLng: null };
  }
  return { minLat, maxLat, minLng, maxLng };
}

// One decimal place is plenty for a "3.2 mi away" label
const roundMiles = (miles) => Math.round(miles * 10) / 10;

module.exports = {
  METERS_PER_MILE,
  DEFAULT_SEARCH_RADIUS_MILES,
  MAX_SEARCH_RADIUS_MILES,
  validateCoordinates,
  toGeoPoint,
  parseProximityQuery,
  haversineMiles,
  boundingBox,
  roundMiles,
};
