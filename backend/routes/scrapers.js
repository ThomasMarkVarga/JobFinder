const express = require('express');
const cache = require('../services/cache');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json(cache.scraperStatus());
});

router.post('/clear-cache', (_req, res) => {
  cache.clearCache();
  res.json({ ok: true });
});

module.exports = router;
