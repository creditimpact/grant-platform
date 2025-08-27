const PipelineCase = require('../models/PipelineCase');
const { ALWAYS_REQUIRED } = require('./requiredDocuments');

const useMemory = process.env.SKIP_DB === 'true';
const memoryStore = new Map();

async function createCase(userId, caseId) {
  const id = caseId || `case-${Date.now()}`;
  if (useMemory) {
    const now = new Date().toISOString();
    memoryStore.set(id, {
      caseId: id,
      userId,
      status: 'open',
      analyzer: { fields: {}, lastUpdated: null },
      questionnaire: { data: {}, lastUpdated: null },
      eligibility: { results: [], requiredForms: [], lastUpdated: null },
      documents: [],
      requiredDocuments: [...ALWAYS_REQUIRED],
      generatedForms: [],
      incompleteForms: [],
      normalized: {},
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }
  const doc = await PipelineCase.create({ userId, caseId: id });
  return doc.caseId;
}

async function updateCase(caseId, updates) {
  if (useMemory) {
    const c = memoryStore.get(caseId);
    if (c) {
      Object.assign(c, updates);
      c.updatedAt = new Date().toISOString();
    }
    return;
  }
  await PipelineCase.findOneAndUpdate(
    { caseId },
    { ...updates, updatedAt: new Date() },
    { new: true }
  );
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

function resetStore() {
  if (useMemory) memoryStore.clear();
}

module.exports = { createCase, updateCase, getCase, getLatestCase, resetStore };
