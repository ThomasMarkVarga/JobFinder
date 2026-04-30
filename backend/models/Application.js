const mongoose = require('mongoose');

const STATUSES = [
  'saved',
  'applied',
  'test_done',
  'interview',
  'hr',
  'offer',
  'rejected',
  'ghosted',
];

const ApplicationSchema = new mongoose.Schema(
  {
    externalId: { type: String, index: true },
    source: String,
    title: String,
    company: String,
    location: String,
    remote: Boolean,
    salary: String,
    description: String,
    url: String,
    postedAt: Date,
    matchedKeywords: [String],
    matchScore: Number,
    llmScore: Number,
    llmSummary: String,
    llmGapSkills: [String],
    coverLetter: String,
    tags: { type: [String], default: [] },
    status: { type: String, enum: STATUSES, default: 'saved' },
    notes: String,
    history: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

ApplicationSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Application', ApplicationSchema);
