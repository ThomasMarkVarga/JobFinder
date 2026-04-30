import { useRef, useState } from 'react';
import { api } from '../api';

export default function CvPanel({ activeCv, allCvs, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setError(null);
    try { await api.uploadCv(file); await onChange(); }
    catch (err) { setError(err.message); }
    finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function activate(id) {
    try { await api.activateCv(id); await onChange(); } catch (e) { setError(e.message); }
  }
  async function remove(id) {
    if (!confirm('Delete this CV?')) return;
    try { await api.deleteCv(id); await onChange(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="surface border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Your CV</h2>
        {activeCv && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">active</span>
        )}
      </div>

      {activeCv ? (
        <div className="space-y-3">
          <div className="text-sm">
            <div className="font-medium truncate">{activeCv.filename}</div>
            <div className="text-xs muted">uploaded {new Date(activeCv.createdAt).toLocaleString()}</div>
          </div>
          {activeCv.titles?.length > 0 && <Section title="Detected roles" items={activeCv.titles} accent="indigo" />}
          {activeCv.skills?.length > 0 && <Section title="Skills" items={activeCv.skills} accent="emerald" />}
          {activeCv.locationHint && (
            <div className="text-xs muted">
              Location hint: <span className="text-slate-700 dark:text-slate-200">{activeCv.locationHint}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm muted mb-3">
          Upload your CV (PDF, DOCX, TXT). Skills + roles are extracted to drive search.
        </p>
      )}

      <div className="mt-4 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => inputRef.current && inputRef.current.click()}
          disabled={uploading}
          className="w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-sm font-medium text-white"
        >
          {uploading ? 'Parsing…' : activeCv ? 'Upload new CV' : 'Upload CV'}
        </button>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        {allCvs && allCvs.length > 1 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs muted hover:opacity-80 underline"
          >
            {showAll ? 'hide' : `manage ${allCvs.length} CVs`}
          </button>
        )}
        {showAll && (
          <ul className="space-y-1 text-xs">
            {allCvs.map((cv) => (
              <li key={cv._id} className="flex items-center gap-2 surface-2 border rounded px-2 py-1">
                <span className="truncate flex-1" title={cv.filename}>{cv.filename}</span>
                {cv.isActive ? (
                  <span className="text-emerald-500">●</span>
                ) : (
                  <button onClick={() => activate(cv._id)} className="text-indigo-500 hover:opacity-80">use</button>
                )}
                <button onClick={() => remove(cv._id)} className="text-rose-500 hover:opacity-80">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Section({ title, items, accent }) {
  const colors = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700/40',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700/40',
  };
  return (
    <div>
      <div className="text-xs uppercase tracking-wide muted mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 20).map((it) => (
          <span key={it} className={`text-xs px-2 py-0.5 rounded border ${colors[accent] || ''}`}>{it}</span>
        ))}
      </div>
    </div>
  );
}
