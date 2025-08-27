const mongoose = require('mongoose');
const { ALWAYS_REQUIRED } = require('../utils/requiredDocuments');

const caseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'open' },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
  requiredDocuments: { type: [String], default: ALWAYS_REQUIRED },
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
