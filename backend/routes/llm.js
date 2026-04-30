const express = require('express');
const Cv = require('../models/Cv');
const Application = require('../models/Application');
const ollama = require('../services/ollama');
const { fetchDetail } = require('../services/descriptionFetcher');

const router = express.Router();

async function getCv(cvId) {
  let cv = null;
  if (cvId) cv = await Cv.findById(cvId).lean();
  if (!cv) cv = await Cv.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  return cv;
}

router.get('/health', async (_req, res) => {
  const ok = await ollama.isHealthy();
  res.json({ ok, model: ollama.MODEL });
});

router.post('/score-job', async (req, res) => {
  try {
    const { cvId, job } = req.body || {};
    const cv = await getCv(cvId);
    if (!cv) return res.status(400).json({ error: 'No CV available' });
    if (!job) return res.status(400).json({ error: 'job is required' });
    const out = await ollama.scoreJob({ cv, job });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/score-application/:id', async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    const cv = await getCv(req.body && req.body.cvId);
    if (!cv) return res.status(400).json({ error: 'No CV available' });
    let description = app.description;
    if ((!description || description.length < 200) && app.url) {
      try { description = await fetchDetail(app.url); } catch {}
    }
    const out = await ollama.scoreJob({ cv, job: { ...app.toObject(), description } });
    app.llmScore = typeof out.score === 'number' ? out.score : null;
    app.llmSummary = out.summary || null;
    app.llmGapSkills = Array.isArray(out.gap_skills) ? out.gap_skills : [];
    if (description && description.length > (app.description || '').length) {
      app.description = description;
    }
    await app.save();
    res.json({ ...out, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cover-letter/:applicationId', async (req, res) => {
  try {
    const app = await Application.findById(req.params.applicationId);
    if (!app) return res.status(404).json({ error: 'Not found' });
    const cv = await getCv(req.body && req.body.cvId);
    if (!cv) return res.status(400).json({ error: 'No CV available' });
    let description = app.description;
    if ((!description || description.length < 200) && app.url) {
      try { description = await fetchDetail(app.url); } catch {}
    }
    const text = await ollama.coverLetter({
      cv,
      job: { ...app.toObject(), description },
      tone: (req.body && req.body.tone) || 'professional',
    });
    app.coverLetter = text;
    await app.save();
    res.json({ text, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gap-analysis', async (req, res) => {
  try {
    const { cvId, jobs } = req.body || {};
    const cv = await getCv(cvId);
    if (!cv) return res.status(400).json({ error: 'No CV available' });
    if (!Array.isArray(jobs) || !jobs.length) return res.status(400).json({ error: 'jobs[] required' });
    const out = await ollama.gapAnalysis({ cv, jobs });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
