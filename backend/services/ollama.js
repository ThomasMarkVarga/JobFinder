// Tiny wrapper around the Ollama HTTP API.
// Default model: qwen2.5:7b (configurable via OLLAMA_MODEL env).

const BASE = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function isHealthy() {
  try {
    const res = await fetch(`${BASE}/api/tags`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.models) && data.models.some((m) => m.name === MODEL);
  } catch {
    return false;
  }
}

async function generate(prompt, { format, options, system } = {}) {
  const body = {
    model: MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.2, ...(options || {}) },
  };
  if (system) body.system = system;
  if (format) body.format = format; // "json" forces JSON output
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.response || '';
}

async function generateJson(prompt, opts = {}) {
  const raw = await generate(prompt, { ...opts, format: 'json' });
  try {
    return JSON.parse(raw);
  } catch {
    // try to recover JSON from a fenced response
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    throw new Error(`Could not parse JSON from model: ${raw.slice(0, 200)}`);
  }
}

// ---------- specific tasks ----------

async function scoreJob({ cv, job }) {
  const cvSnippet = (cv.rawText || '').slice(0, 4000);
  const jd = `${job.title || ''}\n${job.company || ''}\n${job.location || ''}\n${job.description || ''}`.slice(0, 3000);
  const prompt = `You are a hiring matchmaker. Rate how well the candidate's CV fits this job from 0–100.
Return ONLY JSON of shape:
{"score": <int 0-100>, "matched_skills": [<strings>], "gap_skills": [<strings>], "summary": "<one sentence>"}
- "matched_skills": skills/tools/concepts the CV clearly demonstrates AND the job requires.
- "gap_skills": things the job requires but the CV doesn't show.
- Keep arrays short (max 6 items). Prefer concrete tech names over generic phrases.

JOB:
${jd}

CV:
${cvSnippet}`;
  return generateJson(prompt);
}

async function gapAnalysis({ cv, jobs }) {
  const cvSnippet = (cv.rawText || '').slice(0, 3500);
  const samples = (jobs || [])
    .slice(0, 25)
    .map((j, i) => `[${i + 1}] ${j.title || ''} @ ${j.company || ''}\n${(j.description || '').slice(0, 500)}`)
    .join('\n\n');
  const prompt = `Across these job postings, identify the top skills/tools the candidate is MISSING from their CV. Be concrete (tech names). Return JSON:
{"missing": [{"skill": "...", "frequency": <int>, "why": "<why it matters>"}], "strengths": ["<top 3-5 strengths from CV>"], "advice": "<one paragraph>"}

JOBS:
${samples}

CV:
${cvSnippet}`;
  return generateJson(prompt);
}

async function coverLetter({ cv, job, tone = 'professional' }) {
  const cvSnippet = (cv.rawText || '').slice(0, 4000);
  const jd = `${job.title || ''} @ ${job.company || ''}\nLocation: ${job.location || 'n/a'}\n\n${job.description || ''}`.slice(0, 3500);
  const prompt = `Write a concise ${tone} cover letter (under 250 words) tailored to this job using only the candidate's actual CV content. No fabricated experience. No generic filler.
Open with one strong sentence. Use 2 short paragraphs of evidence. Close with one sentence about next steps.
Return ONLY the letter text.

JOB:
${jd}

CV:
${cvSnippet}`;
  return generate(prompt, { options: { temperature: 0.4 } });
}

module.exports = {
  isHealthy,
  generate,
  generateJson,
  scoreJob,
  gapAnalysis,
  coverLetter,
  MODEL,
};
