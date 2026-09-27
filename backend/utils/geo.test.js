// Unit tests for the UC-46 proximity-search math. Run with `npm test` in backend/.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCoordinates,
  toGeoPoint,
  parseProximityQuery,
  haversineMiles,
  boundingBox,
  DEFAULT_SEARCH_RADIUS_MILES,
} = require('./geo');

const EARTH_RADIUS_MILES = 3958.8;
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Point reached by travelling `miles` from `start` on initial bearing `bearingDeg`
function destination(start, bearingDeg, miles) {
  const d = miles / EARTH_RADIUS_MILES;
  const lat1 = rad(start.lat);
  const theta = rad(bearingDeg);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(theta));
  const lng2 = rad(start.lng) + Math.atan2(
    Math.sin(theta) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { lat: deg(lat2), lng: deg(lng2) };
}

test('haversineMiles: one degree of latitude is ~69.09 miles', () => {
  assert.ok(Math.abs(haversineMiles({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 69.09) < 0.01);
  assert.equal(haversineMiles({ lat: 33.45, lng: -112.07 }, { lat: 33.45, lng: -112.07 }), 0);
});

test('boundingBox contains the whole search circle, including at high latitude', () => {
  // lat 70 / 250 mi is where the r / cos(lat) shortcut would undershoot
  for (const center of [{ lat: 33.45, lng: -112.07 }, { lat: 70, lng: 20 }, { lat: -45, lng: 170 }]) {
    for (const radius of [1, 25, 250]) {
      const box = boundingBox(center, radius);
      for (let bearing = 0; bearing < 360; bearing += 1) {
        const p = destination(center, bearing, radius);
        assert.ok(p.lat >= box.minLat - 1e-9 && p.lat <= box.maxLat + 1e-9, `lat ${p.lat} outside box for ${JSON.stringify(center)} r=${radius}`);
        if (box.minLng !== null) {
          assert.ok(p.lng >= box.minLng - 1e-9 && p.lng <= box.maxLng + 1e-9, `lng ${p.lng} outside box for ${JSON.stringify(center)} r=${radius}`);
        }
      }
    }
  }
});

test('boundingBox drops the longitude filter across the antimeridian or over a pole', () => {
  assert.equal(boundingBox({ lat: 10, lng: 179.9 }, 25).minLng, null);
  assert.equal(boundingBox({ lat: -10, lng: -179.9 }, 25).minLng, null);
  const polar = boundingBox({ lat: 89.5, lng: 0 }, 100);
  assert.equal(polar.minLng, null);
  assert.equal(polar.maxLat, 90);
});

test('parseProximityQuery: absent, partial, empty, and default radius', () => {
  assert.equal(parseProximityQuery({}), null);
  assert.equal(parseProximityQuery({ lat: '', lng: '' }), null);
  assert.throws(() => parseProximityQuery({ lat: '33.4' }), /together/);
  assert.throws(() => parseProximityQuery({ lat: '33.4', lng: '' }), /together/);
  assert.deepEqual(parseProximityQuery({ lat: '0', lng: '0' }), {
    center: { lat: 0, lng: 0 },
    radiusMiles: DEFAULT_SEARCH_RADIUS_MILES,
  });
  assert.equal(parseProximityQuery({ lat: '1', lng: '2', radius: '50' }).radiusMiles, 50);
});

test('validateCoordinates accepts a real pair or nothing, rejects everything else', () => {
  assert.doesNotThrow(() => validateCoordinates(undefined));
  assert.doesNotThrow(() => validateCoordinates(null));
  assert.doesNotThrow(() => validateCoordinates({ lat: -33.9, lng: 151.2 }));
  assert.throws(() => validateCoordinates({ lat: '33', lng: 151 }), /Invalid coordinates/);
  assert.throws(() => validateCoordinates({ lat: 91, lng: 0 }), /Invalid coordinates/);
  assert.throws(() => validateCoordinates({ lat: 0, lng: -181 }), /Invalid coordinates/);
  assert.throws(() => validateCoordinates({ lat: NaN, lng: 0 }), /Invalid coordinates/);
  assert.throws(() => validateCoordinates({ lat: 0 }), /Invalid coordinates/);
});

test('toGeoPoint orders GeoJSON as [lng, lat]', () => {
  assert.deepEqual(toGeoPoint({ lat: 33.45, lng: -112.07 }), { type: 'Point', coordinates: [-112.07, 33.45] });
});
