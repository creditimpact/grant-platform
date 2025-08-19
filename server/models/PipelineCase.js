const mongoose = require('mongoose');

const pipelineSchema = new mongoose.Schema({
  // Use simple string identifiers for now since auth is not implemented
  userId: { type: String, required: true },
  // External case identifier provided by clients
  caseId: { type: String, unique: true },
  status: { type: String, default: 'received' },
  // Raw fields extracted from the analyzer step
  analyzer: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Normalized payload combining user answers + analyzer output
  normalized: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Full eligibility results returned by the eligibility engine
  eligibility: { type: mongoose.Schema.Types.Mixed, default: null },
  documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
  generatedForms: {
    type: [
      {
        formKey: String,
        version: Number,
        data: mongoose.Schema.Types.Mixed,
      },
    ],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PipelineCase', pipelineSchema);
