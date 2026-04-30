const express = require('express');
const { fetchDetail } = require('../services/descriptionFetcher');

const router = express.Router();

router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const text = await fetchDetail(url);
    res.json({ url, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
