import { useMemo, useState } from 'react';
import { api } from '../api';

const COLUMNS = [
  { id: 'saved',     label: 'Saved',     color: 'bg-slate-500' },
  { id: 'applied',   label: 'Applied',   color: 'bg-indigo-500' },
  { id: 'test_done', label: 'Test done', color: 'bg-cyan-500' },
  { id: 'interview', label: 'Interview', color: 'bg-amber-500' },
  { id: 'hr',        label: 'HR',        color: 'bg-fuchsia-500' },
  { id: 'offer',     label: 'Offer',     color: 'bg-emerald-500' },
  { id: 'rejected',  label: 'Rejected',  color: 'bg-rose-500' },
  { id: 'ghosted',   label: 'Ghosted',   color: 'bg-slate-400' },
];

export default function Tracker({ applications, onChange, activeCv, llmHealth }) {
  const [filter, setFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const allTags = useMemo(() => {
    const s = new Set();
    applications.forEach((a) => (a.tags || []).forEach((t) => s.add(t)));
    return [...s];
  }, [applications]);

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      if (filter && !`${a.title} ${a.company}`.toLowerCase().includes(filter.toLowerCase())) return false;
      if (tagFilter && !(a.tags || []).includes(tagFilter)) return false;
      return true;
    });
  }, [applications, filter, tagFilter]);

  const grouped = useMemo(() => {
    const out = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    for (const a of filtered) (out[a.status] || (out['saved'] = out['saved'] || [])).push(a);
    return out;
  }, [filtered]);

  async function setStatus(app, status) { await api.updateApplication(app._id, { status }); onChange(); }
  async function setNotes(app, notes)   { await api.updateApplication(app._id, { notes }); onChange(); }
  async function setTags(app, tags)     { await api.updateApplication(app._id, { tags }); onChange(); }
  async function remove(app) {
    if (!confirm(`Remove "${app.title}" from tracker?`)) return;
    await api.deleteApplication(app._id);
    onChange();
  }

  if (applications.length === 0) {
    return (
      <div className="text-center muted py-20 surface border border-dashed rounded-xl">
        Nothing tracked yet. Save jobs from the search tab to start.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          placeholder="search title/company…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="input">
            <option value="">all tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <a href={api.exportCsvUrl()} download className="text-xs px-3 py-1.5 rounded surface-2 border hover:opacity-80">CSV ↓</a>
      </div>
      <div className="overflow-x-auto scrollbar-thin pb-4">
        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3">
          {COLUMNS.map((col) => {
            const items = grouped[col.id] || [];
            return (
              <div key={col.id} className="surface-2 border rounded-xl flex flex-col min-h-[120px]">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/40 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.color}`} />
                    <span className="text-sm font-medium">{col.label}</span>
                  </div>
                  <span className="text-xs muted">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {items.map((a) => (
                    <ApplicationCard
                      key={a._id}
                      app={a}
                      onStatus={(s) => setStatus(a, s)}
                      onNotes={(n) => setNotes(a, n)}
                      onTags={(t) => setTags(a, t)}
                      onRemove={() => remove(a)}
                      cvId={activeCv && activeCv._id}
                      llmAvailable={llmHealth && llmHealth.ok}
                      onChange={onChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApplicationCard({ app, onStatus, onNotes, onTags, onRemove, cvId, llmAvailable, onChange }) {
  const [tagInput, setTagInput] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [showCover, setShowCover] = useState(false);

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    onTags(Array.from(new Set([...(app.tags || []), t])));
    setTagInput('');
  }

  async function genCover() {
    setCoverBusy(true);
    try {
      await api.llmCoverLetter(app._id, { cvId });
      setShowCover(true);
      onChange();
    } finally { setCoverBusy(false); }
  }
  async function scoreLLM() {
    setScoreBusy(true);
    try { await api.llmScoreApplication(app._id, cvId); onChange(); }
    finally { setScoreBusy(false); }
  }

  const isStale = (app.tags || []).includes('stale');

  return (
    <div className={`surface border rounded-lg p-3 text-sm ${isStale ? 'ring-1 ring-amber-400/60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate" title={app.title}>{app.title}</div>
          <div className="text-xs muted truncate">{app.company} · {app.source}</div>
        </div>
        {app.url && (
          <a href={app.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:opacity-80 shrink-0">↗</a>
        )}
      </div>
      {app.location && <div className="text-xs muted mt-1">📍 {app.location}</div>}
      {app.llmScore != null && (
        <div className="text-xs mt-1">
          <span className="text-fuchsia-600 dark:text-fuchsia-300">🤖 {app.llmScore}/100</span>
          {app.llmSummary && <span className="muted italic"> · {app.llmSummary}</span>}
        </div>
      )}

      {(app.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {app.tags.map((t) => (
            <span
              key={t}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                t === 'stale'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 border-amber-400/40'
                  : 'surface-2'
              }`}
            >
              {t}
              <button
                onClick={() => onTags(app.tags.filter((x) => x !== t))}
                className="ml-1 hover:opacity-80"
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mt-2">
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder="+ tag"
          className="input flex-1 py-0.5 text-xs"
        />
      </div>

      <select
        value={app.status}
        onChange={(e) => onStatus(e.target.value)}
        className="mt-2 input w-full py-1 text-xs"
      >
        {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <textarea
        defaultValue={app.notes || ''}
        onBlur={(e) => { if (e.target.value !== (app.notes || '')) onNotes(e.target.value); }}
        placeholder="Notes…"
        rows={2}
        className="mt-2 input w-full py-1 text-xs resize-y"
      />

      {llmAvailable && (
        <div className="flex items-center gap-1 mt-2 text-[10px]">
          <button onClick={scoreLLM} disabled={scoreBusy} className="surface-2 border rounded px-2 py-0.5 hover:opacity-80 disabled:opacity-50">
            {scoreBusy ? '…' : '🤖 score'}
          </button>
          <button onClick={genCover} disabled={coverBusy} className="surface-2 border rounded px-2 py-0.5 hover:opacity-80 disabled:opacity-50">
            {coverBusy ? '…' : '✉ cover letter'}
          </button>
          {app.coverLetter && (
            <button onClick={() => setShowCover((v) => !v)} className="text-indigo-500 hover:opacity-80">
              {showCover ? 'hide' : 'view letter'}
            </button>
          )}
        </div>
      )}

      {showCover && app.coverLetter && (
        <div className="mt-2 surface-2 border rounded p-2 text-xs whitespace-pre-wrap">
          {app.coverLetter}
          <button
            onClick={() => navigator.clipboard.writeText(app.coverLetter)}
            className="ml-2 text-indigo-500 hover:opacity-80"
          >copy</button>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 text-[10px] muted">
        <span>updated {new Date(app.updatedAt).toLocaleDateString()}</span>
        <button onClick={onRemove} className="text-rose-500 hover:opacity-80">remove</button>
      </div>
    </div>
  );
}
