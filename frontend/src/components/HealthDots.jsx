export default function HealthDots({ scraperHealth, llmHealth }) {
  const entries = Object.entries(scraperHealth || {});
  return (
    <div className="hidden md:flex items-center gap-1.5" title="Scraper health (last run)">
      {entries.length === 0 && (
        <span className="text-xs muted italic">no scraper runs yet</span>
      )}
      {entries.map(([name, h]) => {
        const color = h.cooldown
          ? 'bg-rose-500'
          : h.lastOk
            ? 'bg-emerald-500'
            : h.lastOk === false
              ? 'bg-amber-500'
              : 'bg-slate-400';
        return (
          <span
            key={name}
            className="flex items-center gap-1 text-xs"
            title={`${name}: ${h.lastOk ? `ok (${h.lastCount})` : h.lastError || 'idle'}`}
          >
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="hidden xl:inline muted">{name}</span>
          </span>
        );
      })}
    </div>
  );
}
