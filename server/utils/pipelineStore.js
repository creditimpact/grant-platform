const { randomUUID } = require('crypto');

// In-memory case storage keyed by caseId
const cases = new Map();

/**
 * Create a new case for a user
 * @param {string} userId
 * @returns {string} caseId
 */
function createCase(userId) {
  const id = randomUUID();
  cases.set(id, { userId, status: 'received', createdAt: new Date() });
  return id;
}

/**
 * Update an existing case
 * @param {string} caseId
 * @param {object} updates
 */
function updateCase(caseId, updates) {
  const c = cases.get(caseId);
  if (!c) return;
  Object.assign(c, updates);
}

/**
 * Fetch case by id ensuring ownership
 * @param {string} userId
 * @param {string} caseId
 * @returns {object|null}
 */
function getCase(userId, caseId) {
  const c = cases.get(caseId);
  if (!c || c.userId !== userId) return null;
  return c;
}

module.exports = { createCase, updateCase, getCase };
