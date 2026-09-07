/**
 * Bound an array to at most `max` items.
 *
 * This app has two pre-existing, genuinely different capping conventions on
 * `User` — cars keep the *first* N entries submitted (normalizeCars' original
 * `cars.slice(0, MAX_CARS)`), while push tokens keep the *last* N (the
 * original registerPushToken's `splice(0, length - MAX)`, dropping oldest
 * registrations first). `keep` must be passed explicitly at each call site
 * rather than defaulted, so a future caller can't silently get the wrong
 * direction for its use case.
 *
 * @param {Array} arr
 * @param {number} max
 * @param {'start'|'end'} keep - 'start' keeps the first `max` items (drops the
 *   tail); 'end' keeps the last `max` items (drops the head).
 */
const capArray = (arr, max, keep) => {
  if (keep !== 'start' && keep !== 'end') {
    throw new Error(`capArray: 'keep' must be 'start' or 'end', got ${JSON.stringify(keep)}`);
  }
  if (arr.length <= max) return arr;
  return keep === 'start' ? arr.slice(0, max) : arr.slice(arr.length - max);
};

module.exports = { capArray };
