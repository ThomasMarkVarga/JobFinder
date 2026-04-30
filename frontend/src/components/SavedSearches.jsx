import { useState } from 'react';
import { api } from '../api';

export default function SavedSearches({ items, onRefresh, onLoad }) {
  const [busyId, setBusyId] = useState(null);

  async function run(s) {
    setBusyId(s._id);
    try { await api.runSavedSearch(s._id); await onRefresh(); }
    finally { setBusyId(null); }
  }
  async function clearNew(s) {
    await api.clearNewBadge(s._id);
    await onRefresh();
  }
  async function remove(s) {
    if (!confirm(`Delete saved search "${s.name}"?`)) return;
    await api.deleteSavedSearch(s._id);
    await onRefresh();
  }

  return (
    <div className="surface border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Saved searches</h2>
        <span className="text-xs muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs muted">
          Run a search and click <span className="font-mono">★ Save search</span> to track new postings automatically.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s._id} className="surface-2 border rounded-lg p-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => { onLoad(s); clearNew(s); }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs muted truncate">
                    {s.query}{s.location ? ` · ${s.location}` : ''}
                  </div>
                </button>
                {s.newSinceLastRun > 0 && (
                  <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-medium shrink-0">
                    +{s.newSinceLastRun}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] muted">
                <span>every {s.intervalMinutes}m</span>
                {s.lastRunAt && <span>· last {new Date(s.lastRunAt).toLocaleTimeString()}</span>}
                <button
                  onClick={() => run(s)}
                  disabled={busyId === s._id}
                  className="ml-auto text-indigo-500 hover:text-indigo-400"
                >
                  {busyId === s._id ? 'running…' : 'run'}
                </button>
                <button onClick={() => remove(s)} className="text-rose-500 hover:text-rose-400">×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
