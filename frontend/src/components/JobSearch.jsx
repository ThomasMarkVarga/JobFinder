import { useEffect, useState } from 'react';

export default function JobSearch({ activeCv, onSearch, searching, lastResult, onSaveSearch }) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [savedInterval, setSavedInterval] = useState(60);

  useEffect(() => {
    if (activeCv && !location && activeCv.locationHint) setLocation(activeCv.locationHint);
  }, [activeCv]);

  function submit(e) {
    e.preventDefault();
    onSearch({ query: query.trim(), location: location.trim() });
  }

  const placeholderQuery =
    activeCv?.titles?.[0] ||
    (activeCv?.skills?.slice(0, 3).join(' ') || 'e.g. react developer');

  return (
    <form
      onSubmit={submit}
      className="surface border rounded-xl p-4 grid sm:grid-cols-[1fr_220px_auto] gap-3"
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search query (${placeholderQuery})`}
        className="input"
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (city or remote)"
        className="input"
      />
      <button
        disabled={searching}
        className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-medium text-white"
      >
        {searching ? 'Searching…' : 'Search'}
      </button>

      {lastResult && (
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3 text-xs muted pt-1">
          <span>
            <span className="font-medium">{lastResult.totalBeforeDedupe || lastResult.jobs.length}</span> raw → <span className="font-medium">{lastResult.jobs.length}</span> deduped
            for <span className="font-medium">"{lastResult.query}"</span>
            {lastResult.location && <> in <span className="font-medium">{lastResult.location}</span></>}
            {lastResult.cached && <span className="ml-2 text-amber-500">(cached)</span>}
          </span>
          {Object.entries(lastResult.counts).map(([src, n]) => (
            <span key={src} className="px-2 py-0.5 rounded surface-2 border">
              {src}: {n}
            </span>
          ))}
          {Object.keys(lastResult.errors || {}).length > 0 && (
            <span className="text-rose-400" title={JSON.stringify(lastResult.errors)}>
              ⚠ {Object.keys(lastResult.errors).length} failed
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowSaveDialog((v) => !v)}
            className="ml-auto text-indigo-500 hover:text-indigo-400"
          >
            ★ Save search
          </button>
        </div>
      )}

      {showSaveDialog && (
        <div className="sm:col-span-3 surface-2 border rounded-lg p-3 flex flex-wrap gap-2 items-center text-sm">
          <input
            placeholder="name (optional)"
            value={savedName}
            onChange={(e) => setSavedName(e.target.value)}
            className="input flex-1 min-w-[200px]"
          />
          <label className="flex items-center gap-1 text-xs">
            run every
            <input
              type="number"
              min="15"
              value={savedInterval}
              onChange={(e) => setSavedInterval(parseInt(e.target.value) || 60)}
              className="input w-20 py-1"
            /> min
          </label>
          <button
            type="button"
            onClick={async () => {
              await onSaveSearch({ name: savedName, intervalMinutes: savedInterval });
              setShowSaveDialog(false);
              setSavedName('');
            }}
            className="bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded text-white text-sm"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowSaveDialog(false)}
            className="muted hover:opacity-80 text-sm"
          >
            cancel
          </button>
        </div>
      )}
    </form>
  );
}
