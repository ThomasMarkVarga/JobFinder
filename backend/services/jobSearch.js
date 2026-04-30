const linkedin = require('./scrapers/linkedin');
const indeed = require('./scrapers/indeed');
const weworkremotely = require('./scrapers/weworkremotely');
const ejobs = require('./scrapers/ejobs');
const bestjobs = require('./scrapers/bestjobs');
const google = require('./scrapers/google');

const cache = require('./cache');
const { dedupe } = require('./dedupe');

const REGISTRY = { linkedin, indeed, weworkremotely, ejobs, bestjobs, google };

function enabledScrapers() {
  const list = (
    process.env.SCRAPERS || 'linkedin,indeed,weworkremotely,ejobs,bestjobs,google'
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.map((k) => REGISTRY[k]).filter(Boolean);
}

function buildQuery(cv, overrideQuery) {
  if (overrideQuery && overrideQuery.trim()) return overrideQuery.trim();
  const titlePart = (cv.titles || [])[0];
  const skillPart = (cv.skills || []).slice(0, 3).join(' ');
  const q = [titlePart, skillPart].filter(Boolean).join(' ').trim();
  return q || (cv.keywords || []).slice(0, 4).join(' ');
}

function scoreJob(job, cv) {
  const haystack = `${job.title || ''}\n${job.description || ''}\n${job.company || ''}`.toLowerCase();
  const skills = cv.skills || [];
  const matches = [];
  for (const s of skills) {
    if (haystack.includes(s.toLowerCase())) matches.push(s);
  }
  const keywordHits = (cv.keywords || []).filter((k) => haystack.includes(k)).length;
  const titleBonus = (cv.titles || []).some((t) => haystack.includes(t)) ? 5 : 0;
  return {
    matchedKeywords: matches,
    matchScore: matches.length * 3 + keywordHits + titleBonus,
  };
}

async function searchAll({ cv, query, location, useCache = true } = {}) {
  const q = buildQuery(cv, query);
  const timeoutMs = parseInt(process.env.SCRAPE_TIMEOUT_MS || '25000', 10);
  const scrapers = enabledScrapers();
  const enabledNames = scrapers.map((s) => s.name);

  const ck = cache.searchKey({ query: q, location, scrapers: enabledNames });
  if (useCache) {
    const cached = cache.getCached(ck);
    if (cached) return { ...cached, cached: true };
  }

  // skip scrapers in cooldown after recent failures
  const tasks = scrapers.map((s) => {
    if (cache.shouldSkip(s.name)) {
      return Promise.resolve({ skipped: true, name: s.name });
    }
    return s
      .scrape({ query: q, location, limit: 25, timeoutMs })
      .then((rows) => {
        cache.recordScraperRun(s.name, { ok: true, count: rows.length });
        return rows;
      })
      .catch((err) => {
        cache.recordScraperRun(s.name, { ok: false, count: 0, error: err.message });
        console.warn(`[scraper:${s.name}] failed:`, err.message);
        return { error: err.message };
      });
  });

  const settled = await Promise.allSettled(tasks);
  const errors = {};
  const skipped = {};
  const jobs = [];
  settled.forEach((r, i) => {
    const name = scrapers[i].label;
    if (r.status !== 'fulfilled') {
      errors[name] = r.reason && r.reason.message;
      return;
    }
    const v = r.value;
    if (Array.isArray(v)) jobs.push(...v);
    else if (v && v.skipped) skipped[name] = 'cooling down (recent failures)';
    else if (v && v.error) errors[name] = v.error;
  });

  // 1. score each job vs the CV
  const scored = jobs.map((j) => ({ ...j, ...scoreJob(j, cv) }));
  // 2. cross-source dedupe
  const merged = dedupe(scored);
  // 3. sort by match score
  merged.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const result = {
    query: q,
    location: location || null,
    counts: merged.reduce((acc, j) => {
      acc[j.source] = (acc[j.source] || 0) + 1;
      return acc;
    }, {}),
    errors,
    skipped,
    totalBeforeDedupe: scored.length,
    jobs: merged,
    fetchedAt: new Date().toISOString(),
  };
  cache.setCached(ck, result);
  return result;
}

module.exports = { searchAll, buildQuery, scoreJob };
