import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.analytics().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-rose-500 text-sm">{error}</p>;
  if (!data) return <p className="muted text-sm">loading…</p>;
  if (data.total === 0) return (
    <div className="text-center muted py-20 surface border-dashed rounded-xl">
      Save and apply to a few jobs to see analytics here.
    </div>
  );

  const pct = (n) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total tracked" value={data.total} />
        <Stat label="Interview rate" value={pct(data.rates.interviewRate)} sub={`of applied`} />
        <Stat label="Offer rate" value={pct(data.rates.offerRate)} sub={`of applied`} />
        <Stat label="Ghost rate" value={pct(data.rates.ghostRate)} sub={`of applied`} accent="rose" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="By status">
          <BarChart entries={Object.entries(data.byStatus)} />
        </Section>
        <Section title="By source">
          <BarChart entries={Object.entries(data.bySource)} />
        </Section>
      </div>

      <Section title="Funnel by source">
        <table className="w-full text-sm">
          <thead className="text-xs muted">
            <tr>
              <th className="text-left">Source</th>
              <th className="text-right">Saved</th>
              <th className="text-right">Applied</th>
              <th className="text-right">Interview</th>
              <th className="text-right">Offer</th>
              <th className="text-right">Rejected</th>
              <th className="text-right">Ghosted</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.sourceFunnel).map(([src, f]) => (
              <tr key={src} className="border-t border-slate-200/40 dark:border-slate-700/50">
                <td className="py-1.5">{src}</td>
                <td className="text-right">{f.saved}</td>
                <td className="text-right">{f.applied}</td>
                <td className="text-right text-amber-500">{f.interview}</td>
                <td className="text-right text-emerald-500">{f.offer}</td>
                <td className="text-right text-rose-500">{f.rejected}</td>
                <td className="text-right muted">{f.ghosted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <a
        href={api.exportCsvUrl()}
        className="inline-block px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm"
        download
      >
        Export tracker as CSV ↓
      </a>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const accents = { rose: 'text-rose-500', emerald: 'text-emerald-500' };
  return (
    <div className="surface border rounded-xl p-4">
      <div className="text-xs muted">{label}</div>
      <div className={`text-2xl font-semibold ${accents[accent] || ''}`}>{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="surface border rounded-xl p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function BarChart({ entries }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <span className="w-28 truncate">{k}</span>
          <div className="flex-1 h-3 bg-slate-200/30 dark:bg-slate-700/40 rounded">
            <div
              className="h-3 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs muted">{v}</span>
        </div>
      ))}
    </div>
  );
}
