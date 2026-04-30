const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const Cv = require('../models/Cv');
const { parseCv } = require('../services/cvParser');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

router.get('/', async (_req, res) => {
  const cvs = await Cv.find().sort({ createdAt: -1 }).lean();
  res.json(cvs);
});

router.get('/active', async (_req, res) => {
  const cv = await Cv.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  res.json(cv || null);
});

router.post('/', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: cv)' });
    const parsed = await parseCv(req.file.path, req.file.mimetype);
    await Cv.updateMany({}, { $set: { isActive: false } });
    const cv = await Cv.create({
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      rawText: parsed.rawText,
      keywords: parsed.keywords,
      skills: parsed.skills,
      titles: parsed.titles,
      locationHint: parsed.locationHint,
      isActive: true,
    });
    fs.unlink(req.file.path, () => {});
    res.json(cv);
  } catch (err) {
    console.error('[cv] parse failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/activate', async (req, res) => {
  try {
    await Cv.updateMany({}, { $set: { isActive: false } });
    const cv = await Cv.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!cv) return res.status(404).json({ error: 'Not found' });
    res.json(cv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  await Cv.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
