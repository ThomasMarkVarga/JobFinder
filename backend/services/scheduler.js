// Lightweight scheduler that polls saved searches and refreshes due ones.
// Also flags applications that look "ghosted" (>14 days in `applied`).

const SavedSearch = require('../models/SavedSearch');
const Cv = require('../models/Cv');
const Application = require('../models/Application');
const { searchAll } = require('./jobSearch');

const TICK_MS = 60 * 1000; // poll every minute
let tickHandle = null;

async function runOne(savedSearch) {
  try {
    let cv = null;
    if (savedSearch.cvId) cv = await Cv.findById(savedSearch.cvId).lean();
    if (!cv) cv = await Cv.findOne({ isActive: true }).lean();
    if (!cv) cv = { skills: [], titles: [], keywords: [] };

    const result = await searchAll({
      cv,
      query: savedSearch.query,
      location: savedSearch.location,
      useCache: false,
    });

    const known = new Set(savedSearch.knownExternalIds || []);
    const currentIds = result.jobs.map((j) => j.externalId).filter(Boolean);
    const fresh = currentIds.filter((id) => !known.has(id));

    // keep most recent ~500 ids to bound memory
    const merged = [...currentIds, ...savedSearch.knownExternalIds.filter((id) => !currentIds.includes(id))];

    savedSearch.lastRunAt = new Date();
    savedSearch.lastResultCount = result.jobs.length;
    savedSearch.newSinceLastRun = fresh.length;
    savedSearch.knownExternalIds = merged.slice(0, 500);
    await savedSearch.save();

    return { ok: true, total: result.jobs.length, fresh: fresh.length };
  } catch (err) {
    console.warn('[scheduler] saved search failed:', savedSearch.name, err.message);
    return { ok: false, error: err.message };
  }
}

async function runDueSearches() {
  const now = Date.now();
  const due = await SavedSearch.find({ enabled: true });
  for (const s of due) {
    const last = s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0;
    const due = now - last >= (s.intervalMinutes || 60) * 60 * 1000;
    if (due) {
      console.log(`[scheduler] running saved search "${s.name}"`);
      await runOne(s);
    }
  }
}

async function flagGhostedApps() {
  // applications stuck in "applied" for >14 days -> auto-flag tag "stale"
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const apps = await Application.find({
    status: 'applied',
    updatedAt: { $lt: cutoff },
    tags: { $ne: 'stale' },
  });
  for (const a of apps) {
    a.tags = Array.from(new Set([...(a.tags || []), 'stale']));
    await a.save();
  }
  if (apps.length) console.log(`[scheduler] flagged ${apps.length} stale applications`);
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await runDueSearches();
    await flagGhostedApps();
  } catch (e) {
    console.warn('[scheduler] tick error:', e.message);
  } finally {
    busy = false;
  }
}

function start() {
  if (tickHandle) return;
  console.log('[scheduler] started (1 min cadence)');
  tickHandle = setInterval(tick, TICK_MS);
  // first run a few seconds after boot
  setTimeout(tick, 5000);
}

function stop() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

module.exports = { start, stop, runOne };
