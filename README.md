# JobFinder

A local app that ingests your CV, scrapes real job boards (LinkedIn, Indeed, WeWorkRemotely, eJobs, BestJobs) plus Google web results for the long-tail (Greenhouse, Lever, Ashby, company career pages, niche boards) with headless Chromium, ranks results by how well they match your CV, and lets you track applications through a kanban pipeline. Everything is stored locally in MongoDB.

## Stack

- **Backend** — Node.js + Express + Mongoose
- **Scraping** — Puppeteer (with stealth plugin) — *no third-party APIs*
- **Frontend** — React + Vite + Tailwind
- **DB** — MongoDB (local)
- **CV parsing** — `pdf-parse` (PDF), `mammoth` (DOCX), plain text

## Run it

### One-command launch

From the project root:

```bash
npm start
```

This runs `node start.js`, which:

1. Creates `.env` from `.env.example` if missing.
2. Installs backend + frontend deps if `node_modules` is missing.
3. Tries to start the local MongoDB service if it isn't already running on `27017`.
4. Boots the Express API on **http://localhost:5275**.
5. Boots the Vite frontend on **http://localhost:5173** and opens it in your default browser.

On Windows you can also just double-click `start.bat`.

To stop everything: `Ctrl+C` in the terminal.

### Manual / dev

If you'd rather run them in two terminals:

```bash
# terminal 1
npm install
node backend/server.js

# terminal 2
cd frontend && npm install && npm run dev
```

## Config

Everything tunable lives in `.env` (auto-created from `.env.example`):

```
PORT=5275
MONGODB_URI=mongodb://127.0.0.1:27017/jobfinder
HEADLESS=true                # set to "false" to watch Chromium scrape live
SCRAPE_TIMEOUT_MS=25000
SCRAPERS=linkedin,indeed,weworkremotely,ejobs,bestjobs,google
```

Disable a scraper by removing it from `SCRAPERS`.

## How it works

1. **Upload CV** → text extracted, skills/role keywords detected against a built-in dictionary.
2. **Search** → if you don't type a query, one is auto-built from your top role + skills. Each enabled scraper opens its own headless page in parallel, parses the result list, and returns normalized jobs. Results are **deduped across sources** (same job from LinkedIn + a careers page is merged), scored against your CV (skill matches × 3 + keyword hits + role-title bonus), and **cached in-memory** for 10 minutes so re-runs are instant.
3. **Filter / sort bar** above the grid: source pills, remote-only, hide-tracked, min-match, sort by match/date/salary, plus a one-click **🤖 CV gap analysis** that asks the LLM what's frequently missing from your CV across the top 25 results.
4. **Card grid** ranks by match score. Each card has Save / Mark-applied / Open / **🤖 Rate** (LLM scores 0–100 with summary + gap skills).
5. **Saved searches** sidebar — pick `★ Save search` after any query, set an interval, and the in-process scheduler re-runs it; new postings since last run get a green badge.
6. **Tracker tab** — kanban board: `Saved → Applied → Test done → Interview → HR → Offer / Rejected / Ghosted`. Per-card: notes, **tags** (free-form), LLM score, and **✉ cover letter** generation. Applications stuck in `applied` for >14 days get auto-tagged `stale`.
7. **Analytics tab** — total tracked, interview/offer/ghost rates, status + source bar charts, full source funnel, CSV export.

### Local LLM (Ollama)

All AI features call your local Ollama at `http://127.0.0.1:11434` using model `qwen2.5:7b` by default. No API keys, no data leaves your machine. Configurable via `OLLAMA_URL` / `OLLAMA_MODEL` env vars.

If Ollama is offline, the app degrades gracefully — LLM buttons disappear and the header dot turns red.

## Notes on scraping

- LinkedIn's public job search page works without login but rate-limits aggressive use. The stealth plugin masks Puppeteer's automation flags. For personal use this is fine; don't hammer it.
- Indeed sometimes shows a CAPTCHA; if so, set `HEADLESS=false` once and pass it manually — your session won't persist anyway.
- The **`google`** scraper is a long-tail catch-all. It tries Google first; Google almost always serves a CAPTCHA to headless browsers, so it falls back to DuckDuckGo's HTML endpoint (`html.duckduckgo.com`) which is scraper-friendly. Results from sites already covered by dedicated scrapers (LinkedIn, Indeed, etc.) are filtered out, so this only adds *new* sources — Glassdoor, Greenhouse, Lever, Ashby, niche boards like devjob.ro/devjobsscanner, and direct company career pages.
- Site HTML changes will eventually break individual scrapers — fix the selectors in `backend/services/scrapers/*.js`. Each scraper is ~50–150 lines.

## Adding a new scraper

1. Create `backend/services/scrapers/myboard.js` exporting `{ name, label, scrape({query, location, limit, timeoutMs}) }` returning an array of normalized jobs.
2. Register it in `backend/services/jobSearch.js` (`REGISTRY`).
3. Add its key to `SCRAPERS` in `.env`.

## Layout

```
JobFinder/
  start.js                # one-command launcher (Node)
  start.bat               # Windows one-click
  backend/
    server.js
    models/{Cv,Application}.js
    routes/{cv,jobs,applications}.js
    services/
      browser.js          # shared Puppeteer instance + stealth
      cvParser.js
      jobSearch.js        # aggregator + scoring
      ollama.js           # qwen2.5:7b wrapper (score / gap / cover letter)
      cache.js            # search cache + per-scraper health/cooldown
      dedupe.js           # cross-source dedupe by (title+company)
      descriptionFetcher.js  # full-page text via headless Chromium
      scheduler.js        # 1-min tick: saved searches + ghosted-flagger
      scrapers/
        linkedin.js
        indeed.js
        weworkremotely.js
        ejobs.js
        bestjobs.js
        google.js          # long-tail catch-all (excludes the above)
    routes/
      cv.js applications.js jobs.js
      savedSearches.js llm.js analytics.js scrapers.js jobDetails.js
  frontend/
    src/
      App.jsx
      api.js
      components/
        CvPanel.jsx
        JobSearch.jsx
        JobGrid.jsx
        JobCard.jsx
        Tracker.jsx
```
