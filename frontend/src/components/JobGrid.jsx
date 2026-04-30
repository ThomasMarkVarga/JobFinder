import JobCard from './JobCard.jsx';

export default function JobGrid({ result, jobs, searching, applicationByExternalId, onSave, activeCv, llmHealth }) {
  if (searching) {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 surface border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (!result) {
    return (
      <div className="text-center muted py-16 surface border border-dashed rounded-xl">
        Upload a CV and run a search to see matched jobs here.
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="text-center muted py-16 surface border border-dashed rounded-xl">
        No results match your filters. Try widening the query or clearing filters.
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {jobs.map((job) => (
        <JobCard
          key={job.externalId || job.url}
          job={job}
          application={applicationByExternalId.get(job.externalId) || null}
          onSave={onSave}
          activeCv={activeCv}
          llmAvailable={llmHealth && llmHealth.ok}
        />
      ))}
    </div>
  );
}
