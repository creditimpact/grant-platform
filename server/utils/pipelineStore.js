const PipelineCase = require('../models/PipelineCase');

async function createCase(userId) {
  const doc = await PipelineCase.create({ userId });
  return doc.id;
}

async function updateCase(caseId, updates) {
  await PipelineCase.findByIdAndUpdate(caseId, updates, { new: true });
}

async function getCase(userId, caseId) {
  return PipelineCase.findOne({ _id: caseId, userId });
}

module.exports = { createCase, updateCase, getCase };
