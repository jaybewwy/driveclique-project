/**
 * Clamp a `limit` query value to 1..max, falling back to `fallback` when it's
 * missing or not a number.
 */
const clampLimit = (raw, fallback = 20, max = 50) =>
  Math.min(max, Math.max(1, parseInt(raw, 10) || fallback));

/** Parse `page`/`limit` query values into a page number, page size, and skip */
const parsePageParams = ({ page, limit }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = clampLimit(limit);
  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
};

/** The `pagination` object paged list endpoints return alongside their items */
const paginationMeta = ({ page, limit, skip }, total, returnedCount) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasMore: skip + returnedCount < total,
});

module.exports = { clampLimit, parsePageParams, paginationMeta };
