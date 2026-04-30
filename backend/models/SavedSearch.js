const mongoose = require('mongoose');

const SavedSearchSchema = new mongoose.Schema(
  {
    name: String,
    query: String,
    location: String,
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cv' },
    intervalMinutes: { type: Number, default: 60 },
    lastRunAt: Date,
    lastResultCount: Number,
    knownExternalIds: { type: [String], default: [] }, // for "new since last run"
    newSinceLastRun: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedSearch', SavedSearchSchema);
