import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { applyTheme, getTheme, toggleTheme } from './theme';

import CvPanel from './components/CvPanel.jsx';
import JobSearch from './components/JobSearch.jsx';
import JobGrid from './components/JobGrid.jsx';
import FilterBar from './components/FilterBar.jsx';
import Tracker from './components/Tracker.jsx';
import SavedSearches from './components/SavedSearches.jsx';
import Analytics from './components/Analytics.jsx';
import HealthDots from './components/HealthDots.jsx';

const TABS = [
  { id: 'search', label: 'Find jobs' },
  { id: 'tracker', label: 'My applications' },
  { id: 'analytics', label: 'Analytics' },
];

const DEFAULT_FILTERS = {
  sources: [],
  remoteOnly: false,
  hideTracked: false,
  minMatch: 0,
  sortBy: 'match', // match | date | salary
};

export default function App() {
  const [tab, setTab] = useState('search');
  const [theme, setTheme] = useState(getTheme());

  const [activeCv, setActiveCv] = useState(null);
  const [allCvs, setAllCvs] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [applications, setApplications] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [scraperHealth, setScraperHealth] = useState({});
  const [llmHealth, setLlmHealth] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => { applyTheme(theme); }, [theme]);

  async function refreshCv() {
    try {
      const [active, list] = await Promise.all([api.getActiveCv(), api.listCvs()]);
      setActiveCv(active);
      setAllCvs(list);
    } catch (e) { setError(e.message); }
  }
  async function refreshApps() {
    try { setApplications(await api.listApplications()); } catch (e) { setError(e.message); }
  }
  async function refreshSaved() {
    try { setSavedSearches(await api.listSavedSearches()); } catch (e) { setError(e.message); }
  }
  async function refreshHealth() {
    try {
      const [s, l] = await Promise.all([
        api.scrapersHealth().catch(() => ({})),
        api.llmHealth().catch(() => ({ ok: false })),
      ]);
      setScraperHealth(s || {});
      setLlmHealth(l);
    } catch {}
  }

  useEffect(() => {
    refreshCv(); refreshApps(); refreshSaved(); refreshHealth();
    const t = setInterval(() => { refreshHealth(); refreshSaved(); }, 30000);
    return () => clearInterval(t);
  }, []);

  async function runSearch({ query, location }) {
    setError(null); setSearching(true);
    try {
      const result = await api.searchJobs({
        cvId: activeCv && activeCv._id, query, location,
      });
      setSearchResult(result);
      refreshHealth();
    } catch (e) { setError(e.message); } finally { setSearching(false); }
  }

  const applicationByExternalId = useMemo(() => {
    const m = new Map();
    for (const a of applications) if (a.externalId) m.set(a.externalId, a);
    return m;
  }, [applications]);

  async function handleSave(job, status = 'saved') {
    try { await api.saveApplication(job, status); await refreshApps(); }
    catch (e) { setError(e.message); }
  }

  async function handleSaveSearch({ name, intervalMinutes }) {
    if (!searchResult) return;
    try {
      await api.createSavedSearch({
        name: name || `${searchResult.query}${searchResult.location ? ' · ' + searchResult.location : ''}`,
        query: searchResult.query,
        location: searchResult.location,
        intervalMinutes: intervalMinutes || 60,
        cvId: activeCv && activeCv._id,
      });
      await refreshSaved();
    } catch (e) { setError(e.message); }
  }

  // ---- filtering / sorting on the client ----
  const visibleJobs = useMemo(() => {
    if (!searchResult) return [];
    let jobs = [...searchResult.jobs];
    if (filters.sources.length) jobs = jobs.filter((j) => filters.sources.includes(j.source));
    if (filters.remoteOnly) jobs = jobs.filter((j) => j.remote);
    if (filters.minMatch > 0) jobs = jobs.filter((j) => (j.matchScore || 0) >= filters.minMatch);
    if (filters.hideTracked) jobs = jobs.filter((j) => !applicationByExternalId.has(j.externalId));
    if (filters.sortBy === 'date') {
      jobs.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));
    } else if (filters.sortBy === 'salary') {
      const score = (s) => {
        if (!s) return 0;
        const m = String(s).match(/\d+/g);
        return m ? parseInt(m[m.length - 1], 10) : 0;
      };
      jobs.sort((a, b) => score(b.salary) - score(a.salary));
    } // default: keep server-side match-score order
    return jobs;
  }, [searchResult, filters, applicationByExternalId]);

  const totalNew = savedSearches.reduce((acc, s) => acc + (s.newSinceLastRun || 0), 0);
  const trackerCount = applications.length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="surface border-b sticky top-0 z-10 backdrop-blur">
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center font-bold text-white">JF</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">JobFinder</h1>
              <p className="text-xs muted leading-tight">CV-driven local job search · Ollama: <span className={llmHealth?.ok ? 'text-emerald-500' : 'text-rose-400'}>{llmHealth?.ok ? llmHealth.model : 'offline'}</span></p>
            </div>
          </div>
          <nav className="flex gap-1 surface-2 rounded-lg p-1 border">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 text-sm rounded-md transition ${
                  tab === t.id ? 'bg-indigo-500 text-white shadow' : 'hover:opacity-80'
                }`}
              >
                {t.label}
                {t.id === 'tracker' && trackerCount > 0 && (
                  <span className="ml-2 text-xs bg-black/20 px-1.5 py-0.5 rounded">{trackerCount}</span>
                )}
                {t.id === 'search' && totalNew > 0 && (
                  <span className="ml-2 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded">{totalNew} new</span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <HealthDots scraperHealth={scraperHealth} llmHealth={llmHealth} />
            <button
              onClick={() => setTheme(toggleTheme())}
              title="Toggle theme"
              className="text-sm px-2 py-1 rounded surface-2 border hover:opacity-80"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 text-rose-700 dark:text-rose-200 text-sm">
          <div className="max-w-[1500px] mx-auto px-6 py-2 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:opacity-80">dismiss</button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1500px] mx-auto w-full px-6 py-6">
        {tab === 'search' && (
          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            <aside className="space-y-6">
              <CvPanel activeCv={activeCv} allCvs={allCvs} onChange={refreshCv} />
              <SavedSearches
                items={savedSearches}
                onRefresh={refreshSaved}
                onLoad={(s) => runSearch({ query: s.query, location: s.location })}
              />
            </aside>
            <section className="space-y-4">
              <JobSearch
                activeCv={activeCv}
                onSearch={runSearch}
                searching={searching}
                lastResult={searchResult}
                onSaveSearch={handleSaveSearch}
              />
              {searchResult && (
                <FilterBar
                  filters={filters}
                  setFilters={setFilters}
                  result={searchResult}
                  shown={visibleJobs.length}
                  applications={applications}
                  activeCv={activeCv}
                />
              )}
              <JobGrid
                result={searchResult}
                jobs={visibleJobs}
                searching={searching}
                applicationByExternalId={applicationByExternalId}
                onSave={handleSave}
                activeCv={activeCv}
                llmHealth={llmHealth}
              />
            </section>
          </div>
        )}
        {tab === 'tracker' && (
          <Tracker
            applications={applications}
            onChange={refreshApps}
            activeCv={activeCv}
            llmHealth={llmHealth}
          />
        )}
        {tab === 'analytics' && <Analytics />}
      </main>

      <footer className="surface border-t text-xs muted px-6 py-3 text-center">
        Local data only · MongoDB · {trackerCount} tracked · {savedSearches.length} saved searches
      </footer>
    </div>
  );
}
