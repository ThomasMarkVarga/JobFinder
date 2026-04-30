import { useState } from 'react';
import { api } from '../api';

export default function FilterBar({ filters, setFilters, result, shown, applications, activeCv }) {
  const [gap, setGap] = useState(null);
  const [gapBusy, setGapBusy] = useState(false);

  const sources = Array.from(new Set(result.jobs.map((j) => j.source)));

  function toggleSource(src) {
    setFilters((f) => {
      const has = f.sources.includes(src);
      return { ...f, sources: has ? f.sources.filter((s) => s !== src) : [...f.sources, src] };
    });
  }

  async function runGap() {
    setGapBusy(true);
    try {
      const out = await api.llmGapAnalysis(result.jobs.slice(0, 25), activeCv && activeCv._id);
      setGap(out);
    } catch (e) {
      setGap({ error: e.message });
    } finally {
      setGapBusy(false);
    }
  }

  return (
    <div className="surface border rounded-xl p-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="muted">{shown} of {result.jobs.length}</span>

      <div className="flex flex-wrap gap-1">
        {sources.map((s) => {
          const active = filters.sources.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`text-xs px-2 py-1 rounded-full border ${
                active
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'surface-2 hover:opacity-80'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={filters.remoteOnly}
          onChange={(e) => setFilters((f) => ({ ...f, remoteOnly: e.target.checked }))}
        />
        remote only
      </label>

      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={filters.hideTracked}
          onChange={(e) => setFilters((f) => ({ ...f, hideTracked: e.target.checked }))}
        />
        hide tracked
      </label>

      <label className="flex items-center gap-1 text-xs">
        min match
        <input
          type="number"
          min="0"
          max="50"
          value={filters.minMatch}
          onChange={(e) => setFilters((f) => ({ ...f, minMatch: parseInt(e.target.value) || 0 }))}
          className="input w-14 py-0.5"
        />
      </label>

      <label className="flex items-center gap-1 text-xs">
        sort
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
          className="input py-0.5"
        >
          <option value="match">match</option>
          <option value="date">posted date</option>
          <option value="salary">salary</option>
        </select>
      </label>

      <button
        onClick={runGap}
        disabled={gapBusy}
        className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white"
        title="LLM analyzes top 25 results to surface skill gaps"
      >
        {gapBusy ? 'thinking…' : '🤖 Analyze CV gaps'}
      </button>

      {gap && (
        <div className="w-full mt-2 surface-2 border rounded-lg p-3 text-xs">
          <button
            onClick={() => setGap(null)}
            className="float-right muted hover:opacity-100"
          >
            close
          </button>
          {gap.error ? (
            <p className="text-rose-500">⚠ {gap.error}</p>
          ) : (
            <>
              {gap.advice && <p className="mb-2">{gap.advice}</p>}
              {Array.isArray(gap.missing) && gap.missing.length > 0 && (
                <div className="mb-2">
                  <span className="font-medium">Missing skills (by frequency):</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {gap.missing.map((m) => (
                      <span
                        key={m.skill}
                        className="px-2 py-0.5 rounded bg-amber-900/30 text-amber-700 dark:text-amber-200 border border-amber-700/40"
                        title={m.why}
                      >
                        {m.skill} ×{m.frequency}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(gap.strengths) && gap.strengths.length > 0 && (
                <div>
                  <span className="font-medium">Your strengths:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {gap.strengths.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border border-emerald-700/40"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
