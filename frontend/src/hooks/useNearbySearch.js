import { useEffect, useState } from 'react';
import { drivesAPI } from '../services/api';

// Proximity search (UC-46). Radius is in miles and must stay within the
// backend's MAX_SEARCH_RADIUS_MILES (250).
export const RADIUS_OPTIONS = [10, 25, 50, 100, 250];
const DEFAULT_RADIUS = 25;
const NEARBY_DRIVES_LIMIT = 6;

// Browser coordinates are rounded to ~1 km before they go anywhere — plenty
// for a radius search, and they end up in request URLs and access logs.
const roundCoord = (n) => Math.round(n * 100) / 100;

/**
 * Find Clubs' "Search near" state: the search center (`near`, from the
 * browser's location or a picked city), the radius, and the upcoming drives
 * within it. `nearbyDrives` is null while loading.
 */
export const useNearbySearch = () => {
  const [near, setNear] = useState(null); // { lat, lng, label }
  const [nearQuery, setNearQuery] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [nearbyDrives, setNearbyDrives] = useState(null);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    setNearbyDrives(null);
    drivesAPI.getNearby(near.lat, near.lng, radius, NEARBY_DRIVES_LIMIT)
      .then((res) => {
        if (!cancelled && res.data.success) setNearbyDrives(res.data.drives);
      })
      .catch((error) => {
        console.error('Failed to load nearby drives:', error);
        if (!cancelled) setNearbyDrives([]);
      });
    return () => { cancelled = true; };
  }, [near, radius]);

  const locateMe = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError("Your browser can't share its location. Pick a city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNear({ lat: roundCoord(coords.latitude), lng: roundCoord(coords.longitude), label: 'your location' });
        setNearQuery('');
        setLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location access is blocked for this site. Pick a city instead.'
            : "Couldn't get your location. Pick a city instead."
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const pickPlace = ({ label, lat, lng }) => {
    setNear({ lat, lng, label });
    setLocationError('');
  };

  const clear = () => {
    setNear(null);
    setNearQuery('');
    setLocationError('');
  };

  return {
    near,
    nearQuery,
    setNearQuery,
    radius,
    setRadius,
    locating,
    locationError,
    nearbyDrives,
    locateMe,
    pickPlace,
    clear,
  };
};
