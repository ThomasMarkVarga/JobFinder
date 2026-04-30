// Simple in-process TTL cache + per-scraper health & rate-limit tracking.

const TTL_MS = parseInt(process.env.SCRAPE_CACHE_TTL_MS || '600000', 10); // 10 min default
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 min
const RATE_FAIL_LIMIT = 2;

const searchCache = new Map(); // key -> { at, value }
const scraperHistory = new Map(); // name -> [{ at, ok, count, error }]

function searchKey({ query, location, scrapers }) {
  const s = (scrapers || []).slice().sort().join(',');
  return `${(query || '').trim().toLowerCase()}|${(location || '').trim().toLowerCase()}|${s}`;
}

function getCached(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  searchCache.set(key, { at: Date.now(), value });
  // bound size
  if (searchCache.size > 64) {
    const first = searchCache.keys().next().value;
    searchCache.delete(first);
  }
}

function clearCache() {
  searchCache.clear();
}

function recordScraperRun(name, { ok, count, error }) {
  if (!scraperHistory.has(name)) scraperHistory.set(name, []);
  const arr = scraperHistory.get(name);
  arr.push({ at: Date.now(), ok, count, error: error ? String(error).slice(0, 200) : null });
  // keep last 20
  while (arr.length > 20) arr.shift();
}

function recentFailures(name) {
  const arr = scraperHistory.get(name) || [];
  const cutoff = Date.now() - RATE_WINDOW_MS;
  return arr.filter((r) => r.at >= cutoff && !r.ok).length;
}

function shouldSkip(name) {
  return recentFailures(name) >= RATE_FAIL_LIMIT;
}

function scraperStatus() {
  const out = {};
  for (const [name, arr] of scraperHistory.entries()) {
    const last = arr[arr.length - 1] || null;
    const failsRecent = recentFailures(name);
    out[name] = {
      lastRun: last ? new Date(last.at).toISOString() : null,
      lastOk: last ? last.ok : null,
      lastCount: last ? last.count : null,
      lastError: last ? last.error : null,
      recentFailures: failsRecent,
      cooldown: failsRecent >= RATE_FAIL_LIMIT,
    };
  }
  return out;
}

module.exports = {
  searchKey,
  getCached,
  setCached,
  clearCache,
  recordScraperRun,
  shouldSkip,
  scraperStatus,
  TTL_MS,
};
