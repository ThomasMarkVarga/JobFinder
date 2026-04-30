const base = '/api';

async function json(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) return res.json();
  return res.text();
}

const j = (path, opts = {}) => fetch(`${base}${path}`, opts).then(json);

export const api = {
  health: () => j('/health'),

  // CV
  uploadCv: (file) => {
    const fd = new FormData();
    fd.append('cv', file);
    return j('/cv', { method: 'POST', body: fd });
  },
  getActiveCv: () => j('/cv/active'),
  listCvs: () => j('/cv'),
  activateCv: (id) => j(`/cv/${id}/activate`, { method: 'POST' }),
  deleteCv: (id) => j(`/cv/${id}`, { method: 'DELETE' }),

  // Search
  searchJobs: ({ cvId, query, location } = {}) => {
    const p = new URLSearchParams();
    if (cvId) p.set('cvId', cvId);
    if (query) p.set('query', query);
    if (location) p.set('location', location);
    return j(`/jobs/search?${p.toString()}`);
  },
  jobDetail: (url) => j(`/jobs/details?url=${encodeURIComponent(url)}`),

  // Applications
  listApplications: () => j('/applications'),
  getStatuses: () => j('/applications/statuses'),
  saveApplication: (job, status = 'saved') =>
    j('/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...job, status }),
    }),
  updateApplication: (id, patch) =>
    j(`/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  deleteApplication: (id) => j(`/applications/${id}`, { method: 'DELETE' }),

  // Saved searches
  listSavedSearches: () => j('/saved-searches'),
  createSavedSearch: (data) =>
    j('/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  runSavedSearch: (id) => j(`/saved-searches/${id}/run`, { method: 'POST' }),
  clearNewBadge: (id) => j(`/saved-searches/${id}/clear-new`, { method: 'POST' }),
  deleteSavedSearch: (id) => j(`/saved-searches/${id}`, { method: 'DELETE' }),

  // LLM
  llmHealth: () => j('/llm/health'),
  llmScore: (job, cvId) =>
    j('/llm/score-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, cvId }),
    }),
  llmScoreApplication: (id, cvId) =>
    j(`/llm/score-application/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvId }),
    }),
  llmCoverLetter: (applicationId, opts = {}) =>
    j(`/llm/cover-letter/${applicationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }),
  llmGapAnalysis: (jobs, cvId) =>
    j('/llm/gap-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, cvId }),
    }),

  // Scrapers + Analytics
  scrapersHealth: () => j('/scrapers/health'),
  clearCache: () => j('/scrapers/clear-cache', { method: 'POST' }),
  analytics: () => j('/analytics'),
  exportCsvUrl: () => `${base}/analytics/export.csv`,
};
