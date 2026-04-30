const express = require('express');
const Application = require('../models/Application');

const router = express.Router();

router.get('/', async (_req, res) => {
  const apps = await Application.find().lean();
  const byStatus = {};
  const bySource = {};
  let interviewedFromApplied = 0;
  let totalApplied = 0;
  let offers = 0;
  let rejects = 0;
  let ghosted = 0;
  const ageDays = [];

  const now = Date.now();
  for (const a of apps) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    if (a.source) bySource[a.source] = (bySource[a.source] || 0) + 1;
    if (['applied', 'test_done', 'interview', 'hr', 'offer', 'rejected'].includes(a.status)) totalApplied++;
    if (['interview', 'hr', 'offer'].includes(a.status)) interviewedFromApplied++;
    if (a.status === 'offer') offers++;
    if (a.status === 'rejected') rejects++;
    if (a.status === 'ghosted') ghosted++;
    if (a.createdAt) ageDays.push((now - new Date(a.createdAt).getTime()) / (24 * 60 * 60 * 1000));
  }

  // funnel rate per source
  const sourceFunnel = {};
  for (const a of apps) {
    const src = a.source || 'unknown';
    if (!sourceFunnel[src]) sourceFunnel[src] = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0, ghosted: 0 };
    if (a.status === 'saved') sourceFunnel[src].saved++;
    if (['applied', 'test_done', 'interview', 'hr', 'offer', 'rejected', 'ghosted'].includes(a.status))
      sourceFunnel[src].applied++;
    if (['interview', 'hr', 'offer'].includes(a.status)) sourceFunnel[src].interview++;
    if (a.status === 'offer') sourceFunnel[src].offer++;
    if (a.status === 'rejected') sourceFunnel[src].rejected++;
    if (a.status === 'ghosted') sourceFunnel[src].ghosted++;
  }

  res.json({
    total: apps.length,
    byStatus,
    bySource,
    sourceFunnel,
    rates: {
      interviewRate: totalApplied ? interviewedFromApplied / totalApplied : 0,
      offerRate: totalApplied ? offers / totalApplied : 0,
      rejectionRate: totalApplied ? rejects / totalApplied : 0,
      ghostRate: totalApplied ? ghosted / totalApplied : 0,
    },
    avgAgeDays: ageDays.length ? ageDays.reduce((a, b) => a + b, 0) / ageDays.length : 0,
  });
});

router.get('/export.csv', async (_req, res) => {
  const apps = await Application.find().sort({ updatedAt: -1 }).lean();
  const cols = [
    'title', 'company', 'location', 'source', 'status', 'tags', 'matchScore',
    'llmScore', 'salary', 'url', 'createdAt', 'updatedAt', 'notes',
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(Array.isArray(v) ? v.join('|') : v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [cols.join(',')];
  for (const a of apps) lines.push(cols.map((c) => escape(a[c])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
  res.send(lines.join('\n'));
});

module.exports = router;
