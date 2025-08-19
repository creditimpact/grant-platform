const PipelineCase = require('../models/PipelineCase');

const useMemory = process.env.SKIP_DB === 'true';
const memoryStore = new Map();

async function createCase(userId, caseId) {
  const id = caseId || `case-${Date.now()}`;
  if (useMemory) {
    memoryStore.set(id, {
      caseId: id,
      userId,
      status: 'received',
      analyzer: {},
      normalized: {},
      eligibility: null,
      documents: [],
      generatedForms: [],
      createdAt: new Date(),
    });
    return id;
  }
  const doc = await PipelineCase.create({ userId, caseId: id });
  return doc.caseId;
}

async function updateCase(caseId, updates) {
  if (useMemory) {
    const c = memoryStore.get(caseId);
    if (c) Object.assign(c, updates);
    return;
  }
  await PipelineCase.findOneAndUpdate({ caseId }, updates, { new: true });
}

async function getCase(userId, caseId) {
  if (useMemory) {
    return memoryStore.get(caseId);
  }
  return PipelineCase.findOne({ caseId });
}

async function getLatestCase(userId) {
  if (useMemory) {
    let latest = null;
    for (const c of memoryStore.values()) {
      if (c.userId === userId && (!latest || c.createdAt > latest.createdAt)) {
        latest = c;
      }
    }
    return latest;
  }
  return PipelineCase.findOne({ userId }).sort({ createdAt: -1 });
}

module.exports = { createCase, updateCase, getCase, getLatestCase };
