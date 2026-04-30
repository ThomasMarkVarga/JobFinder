import { useState } from 'react';
import { api } from '../api';

const STATUS_META = {
  saved:     { label: 'Saved',     ring: 'border-slate-400 dark:border-slate-500',   bg: 'bg-slate-200 dark:bg-slate-700/50',   text: 'text-slate-700 dark:text-slate-200' },
  applied:   { label: 'Applied',   ring: 'border-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/40',  text: 'text-indigo-700 dark:text-indigo-200' },
  test_done: { label: 'Test done', ring: 'border-cyan-500',    bg: 'bg-cyan-100 dark:bg-cyan-900/40',    text: 'text-cyan-700 dark:text-cyan-200' },
  interview: { label: 'Interview', ring: 'border-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/40',   text: 'text-amber-700 dark:text-amber-200' },
  hr:        { label: 'HR',        ring: 'border-fuchsia-500', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', text: 'text-fuchsia-700 dark:text-fuchsia-200' },
  offer:     { label: 'Offer',     ring: 'border-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-200' },
  rejected:  { label: 'Rejected',  ring: 'border-rose-500',    bg: 'bg-rose-100 dark:bg-rose-900/40',    text: 'text-rose-700 dark:text-rose-200' },
  ghosted:   { label: 'Ghosted',   ring: 'border-slate-500',   bg: 'bg-slate-200 dark:bg-slate-800/60',   text: 'text-slate-600 dark:text-slate-300' },
};

function timeAgo(date) {
  if (!date) return null;
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}

export default function JobCard({ job, application, onSave, activeCv, llmAvailable }) {
  const [expanded, setExpanded] = useState(false);
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmResult, setLlmResult] = useState(null);
  const status = application && application.status;
  const meta = status ? STATUS_META[status] : null;
  const isTracked = !!application;
  const isApplied = isTracked && status !== 'saved';

  async function llmRate() {
    setLlmBusy(true);
    try {
      const out = await api.llmScore(job, activeCv && activeCv._id);
      setLlmResult(out);
    } catch (e) {
      setLlmResult({ error: e.message });
    } finally {
      setLlmBusy(false);
    }
  }

  return (
    <div className={`surface border rounded-xl p-4 flex flex-col gap-3 transition ${meta ? meta.ring : 'hover:border-indigo-500/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug truncate" title={job.title}>{job.title}</h3>
          <div className="text-sm muted truncate">{job.company || '—'}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {meta && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.ring} ${meta.bg} ${meta.text}`}>
              ✓ {meta.label}
            </span>
          )}
          {job.matchScore > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700/40"
              title={`Matched: ${(job.matchedKeywords || []).join(', ')}`}
            >
              {job.matchScore} match
            </span>
          )}
          {llmResult && !llmResult.error && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-200 border border-fuchsia-300 dark:border-fuchsia-700/40"
              title={llmResult.summary}
            >
              🤖 {llmResult.score}
            </span>
          )}
        </div>
      </div>

      <div className="text-xs muted flex flex-wrap gap-x-3 gap-y-1">
        {job.location && <span>📍 {job.location}</span>}
        {job.remote && <span className="text-emerald-500">remote</span>}
        {job.salary && <span>💰 {job.salary}</span>}
        {job.postedAt && <span>🕒 {timeAgo(job.postedAt)}</span>}
        <span className="ml-auto">
          {(job.mergedSources && job.mergedSources.length > 1)
            ? `${job.source} +${job.mergedSources.length - 1}`
            : job.source}
        </span>
      </div>

      {(job.matchedKeywords || []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.matchedKeywords.slice(0, 6).map((k) => (
            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/30">
              {k}
            </span>
          ))}
        </div>
      )}

      {llmResult && !llmResult.error && (
        <div className="text-xs surface-2 border rounded p-2">
          <p className="italic">{llmResult.summary}</p>
          {Array.isArray(llmResult.gap_skills) && llmResult.gap_skills.length > 0 && (
            <div className="mt-1">
              <span className="muted">missing: </span>
              {llmResult.gap_skills.slice(0, 5).map((g) => (
                <span key={g} className="ml-1 text-amber-600 dark:text-amber-300">{g}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {job.description && (
        <p className={`text-xs muted ${expanded ? '' : 'line-clamp-3'}`}>{job.description}</p>
      )}
      {job.description && job.description.length > 180 && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-indigo-500 hover:text-indigo-400 self-start">
          {expanded ? 'show less' : 'show more'}
        </button>
      )}

      <div className="mt-auto flex items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg surface-2 hover:opacity-80 border">
            Open ↗
          </a>
        )}
        {llmAvailable && (
          <button
            onClick={llmRate}
            disabled={llmBusy}
            className="text-xs px-3 py-1.5 rounded-lg surface-2 border hover:opacity-80 disabled:opacity-50"
            title="Score with qwen2.5"
          >
            {llmBusy ? '…' : '🤖 Rate'}
          </button>
        )}
        {!isTracked && (
          <button onClick={() => onSave(job, 'saved')} className="text-xs px-3 py-1.5 rounded-lg surface-2 border hover:opacity-80">
            Save
          </button>
        )}
        {!isApplied && (
          <button onClick={() => onSave(job, 'applied')} className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium">
            Mark applied
          </button>
        )}
        {isApplied && <span className="ml-auto text-xs muted italic">tracked → kanban</span>}
      </div>
    </div>
  );
}
