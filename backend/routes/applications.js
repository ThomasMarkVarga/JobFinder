const express = require('express');
const Application = require('../models/Application');

const router = express.Router();

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const apps = await Application.find(filter).sort({ updatedAt: -1 }).lean();
  res.json(apps);
});

router.get('/statuses', (_req, res) => {
  res.json(Application.STATUSES);
});

router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (data.externalId) {
      const existing = await Application.findOne({ externalId: data.externalId });
      if (existing) {
        // upgrade the status if a stronger one was requested
        if (data.status && data.status !== existing.status) {
          existing.status = data.status;
          existing.history.push({
            status: data.status,
            at: new Date(),
            note: 'updated from search',
          });
          await existing.save();
        }
        return res.json(existing);
      }
    }
    const initialStatus = data.status || 'saved';
    const app = await Application.create({
      ...data,
      status: initialStatus,
      history: [{ status: initialStatus, at: new Date(), note: 'created' }],
    });
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    const { status, notes, tags } = req.body || {};
    if (status && status !== app.status) {
      app.status = status;
      app.history.push({ status, at: new Date(), note: req.body.note });
    }
    if (notes !== undefined) app.notes = notes;
    if (Array.isArray(tags)) app.tags = tags.map((t) => String(t).trim()).filter(Boolean);
    await app.save();
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  await Application.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
