const express = require('express');
const fetchFn =
  global.pipelineFetch ||
  (global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const { getServiceHeaders } = require('../utils/serviceHeaders');

const router = express.Router();

function aggregateMissing(results) {
  return [
    ...new Set(results.flatMap((r) => r.missing_fields || [])),
  ];
}

router.get('/eligibility-report', async (req, res) => {
  const userId = 'dev-user';
  const { caseId } = req.query;
  if (!caseId) return res.status(400).json({ message: 'caseId required' });
  const c = await getCase(userId, caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  if (!c.eligibility || !c.eligibility.results) {
    return res.status(404).json({ message: 'Eligibility not computed' });
  }
  const missing = aggregateMissing(c.eligibility.results);
  res.json({
    caseId,
    eligibility: c.eligibility,
    missingFieldsSummary: missing,
    analyzerFields: c.analyzer?.fields,
    documents: c.documents,
    status: c.status,
    generatedForms: c.generatedForms,
  });
});

router.post('/eligibility-report', async (req, res) => {
  const userId = 'dev-user';
  let { caseId, payload = {} } = req.body || {};
  let base = payload;
  if (caseId) {
    const c = await getCase(userId, caseId);
    if (!c) return res.status(404).json({ message: 'Case not found' });
    base = { ...(c.analyzer?.fields || {}), ...payload };
  } else {
    caseId = await createCase(userId);
  }

  const engineBase = process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
  const engineUrl = `${engineBase.replace(/\/$/, '')}/check`;
  const resp = await fetchFn(engineUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getServiceHeaders('ELIGIBILITY_ENGINE', req) },
    body: JSON.stringify(base),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return res
      .status(502)
      .json({ message: `Eligibility engine error ${resp.status}`, details: text });
  }
  const results = await resp.json();
  const requiredForms = [
    ...new Set(results.flatMap((r) => r.requiredForms || [])),
  ];
  const eligibility = {
    results,
    requiredForms,
    lastUpdated: new Date().toISOString(),
  };
  await updateCase(caseId, { eligibility });
  if (!req.body.caseId) {
    await updateCase(caseId, {
      analyzer: { fields: base, lastUpdated: new Date().toISOString() },
    });
  }
  const c = await getCase(userId, caseId);
  const missing = aggregateMissing(results);
  res.json({
    caseId,
    eligibility,
    missingFieldsSummary: missing,
    analyzerFields: c.analyzer?.fields,
    documents: c.documents,
    status: c.status,
    generatedForms: c.generatedForms,
  });
});

module.exports = router;
