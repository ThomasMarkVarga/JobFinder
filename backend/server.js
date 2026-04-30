require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const cvRouter = require('./routes/cv');
const jobsRouter = require('./routes/jobs');
const applicationsRouter = require('./routes/applications');
const savedSearchesRouter = require('./routes/savedSearches');
const llmRouter = require('./routes/llm');
const analyticsRouter = require('./routes/analytics');
const scrapersRouter = require('./routes/scrapers');
const jobDetailsRouter = require('./routes/jobDetails');
const { closeBrowser } = require('./services/browser');
const scheduler = require('./services/scheduler');

const PORT = process.env.PORT || 5275;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jobfinder';

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('[mongo] connected to', MONGODB_URI);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mongo: mongoose.connection.readyState === 1 });
  });

  app.use('/api/cv', cvRouter);
  app.use('/api/jobs/details', jobDetailsRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/saved-searches', savedSearchesRouter);
  app.use('/api/llm', llmRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/scrapers', scrapersRouter);

  const distDir = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));

  // start the scheduler last, so the API is ready first
  scheduler.start();

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      console.log(`[shutdown] received ${sig}, closing browser…`);
      scheduler.stop();
      await closeBrowser();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
