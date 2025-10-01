const mongoose = require('mongoose');
const { ALWAYS_REQUIRED } = require('../utils/requiredDocuments');

const documentSchema = new mongoose.Schema(
  {
    key: String,
    filename: String,
    size: Number,
    contentType: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const generatedFormSchema = new mongoose.Schema(
  {
    formName: String,
    formId: String,
    payload: mongoose.Schema.Types.Mixed,
    files: [String],
    url: String,
    name: String,
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const pipelineSchema = new mongoose.Schema(
  {
    // Use simple string identifiers for now since auth is not implemented
    userId: { type: String, required: true },
    // External case identifier provided by clients
    caseId: { type: String, unique: true },
    status: { type: String, default: 'open' },
    analyzer: {
      fields: { type: mongoose.Schema.Types.Mixed, default: {} },
      lastUpdated: Date,
    },
    questionnaire: {
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
      lastUpdated: Date,
    },
    eligibility: {
      results: { type: [mongoose.Schema.Types.Mixed], default: [] },
      requiredForms: { type: [String], default: [] },
      requiredDocuments: { type: [String], default: [] },
      lastUpdated: Date,
    },
    documents: { type: [documentSchema], default: [] },
    requiredDocuments: { type: [String], default: ALWAYS_REQUIRED },
    generatedForms: { type: [generatedFormSchema], default: [] },
    normalized: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('PipelineCase', pipelineSchema);
