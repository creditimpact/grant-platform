const mongoose = require('mongoose');

// This model mirrors the in-memory structure used by pipelineStore. The
// `documents` array previously stored arbitrary objects, but for the dynamic
// checklist feature we formalise the shape so each entry represents a specific
// document upload and its processing state.

const documentSchema = new mongoose.Schema(
  {
    doc_type: String,
    status: { type: String, default: 'uploaded' },
    evidence_key: String,
    analyzer_fields: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const caseSchema = new mongoose.Schema({
  caseId: { type: String, unique: true, sparse: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'open' },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  documents: { type: [documentSchema], default: [] },
  requiredDocuments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  eligibility: { type: mongoose.Schema.Types.Mixed, default: null },
  normalized: { type: mongoose.Schema.Types.Mixed, default: {} },
  generatedForms: {
    type: [
      {
        formId: String,
        formKey: String,
        version: Number,
        data: mongoose.Schema.Types.Mixed,
        url: String,
        name: String,
      },
    ],
    default: [],
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Case', caseSchema);
