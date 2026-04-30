const mongoose = require('mongoose');

const CvSchema = new mongoose.Schema(
  {
    filename: String,
    mimetype: String,
    rawText: String,
    keywords: [String],
    skills: [String],
    titles: [String],
    locationHint: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cv', CvSchema);
