const express = require('express');
const Cv = require('../models/Cv');
const { searchAll } = require('../services/jobSearch');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { cvId, query, location } = req.query;
    let cv = null;
    if (cvId) cv = await Cv.findById(cvId).lean();
    if (!cv) cv = await Cv.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    if (!cv && !query) {
      return res.status(400).json({ error: 'Upload a CV first or pass ?query=' });
    }
    const result = await searchAll({
      cv: cv || { skills: [], titles: [], keywords: [] },
      query,
      location,
    });
    res.json(result);
  } catch (err) {
    console.error('[jobs] search failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
