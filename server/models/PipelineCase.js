const mongoose = require('mongoose');

const pipelineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'received' },
  normalized: { type: mongoose.Schema.Types.Mixed, default: {} },
  eligibility: { type: mongoose.Schema.Types.Mixed, default: null },
  documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PipelineCase', pipelineSchema);
