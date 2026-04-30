const express = require('express');
const SavedSearch = require('../models/SavedSearch');
const { runOne } = require('../services/scheduler');

const router = express.Router();

router.get('/', async (_req, res) => {
  res.json(await SavedSearch.find().sort({ createdAt: -1 }).lean());
});

router.post('/', async (req, res) => {
  try {
    const { name, query, location, intervalMinutes, cvId } = req.body || {};
    const s = await SavedSearch.create({
      name: name || query || 'Untitled',
      query,
      location,
      intervalMinutes: intervalMinutes || 60,
      cvId: cvId || null,
    });
    // run once immediately so the user sees results
    runOne(s).catch(() => {});
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const s = await SavedSearch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const s = await SavedSearch.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    const out = await runOne(s);
    res.json({ ...out, savedSearch: s });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/clear-new', async (req, res) => {
  const s = await SavedSearch.findById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.newSinceLastRun = 0;
  await s.save();
  res.json(s);
});

router.delete('/:id', async (req, res) => {
  await SavedSearch.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
