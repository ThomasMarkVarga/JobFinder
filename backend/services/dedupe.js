// Cross-source deduping. Two jobs are considered the same when their
// (normalized title + normalized company) match. We keep the entry with the
// richest description and union sources / matched-keywords.

function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(senior|junior|lead|staff|principal|sr|jr|mid|the|a|an|with|of|in|at|for)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function jobKey(job) {
  const t = norm(job.title);
  const c = norm(job.company);
  if (!t || !c) return null;
  return `${t}|${c}`;
}

function dedupe(jobs) {
  const map = new Map();
  for (const j of jobs) {
    const key = jobKey(j);
    if (!key) {
      map.set(`__${Math.random()}`, j);
      continue;
    }
    if (!map.has(key)) {
      map.set(key, { ...j, mergedSources: [j.source], duplicateUrls: [] });
      continue;
    }
    const cur = map.get(key);
    // pick the entry with the longest description as the canonical one
    if ((j.description || '').length > (cur.description || '').length) {
      const merged = {
        ...j,
        mergedSources: Array.from(new Set([...(cur.mergedSources || [cur.source]), j.source])),
        duplicateUrls: Array.from(new Set([...(cur.duplicateUrls || []), cur.url].filter(Boolean))),
      };
      map.set(key, merged);
    } else {
      cur.mergedSources = Array.from(new Set([...(cur.mergedSources || [cur.source]), j.source]));
      cur.duplicateUrls = Array.from(
        new Set([...(cur.duplicateUrls || []), j.url].filter(Boolean)),
      );
      // fill in missing fields
      cur.salary = cur.salary || j.salary;
      cur.location = cur.location || j.location;
      cur.postedAt = cur.postedAt || j.postedAt;
      cur.matchScore = Math.max(cur.matchScore || 0, j.matchScore || 0);
      cur.matchedKeywords = Array.from(
        new Set([...(cur.matchedKeywords || []), ...(j.matchedKeywords || [])]),
      );
    }
  }
  return [...map.values()];
}

module.exports = { dedupe, norm, jobKey };
