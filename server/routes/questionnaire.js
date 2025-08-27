const express = require('express');
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const logger = require('../utils/logger');
const { getRequiredDocuments } = require('../utils/requiredDocuments');

const router = express.Router();

function aggregateMissing(results) {
  return [
    ...new Set(results.flatMap((r) => r.missing_fields || [])),
  ];
}

router.get(['/questionnaire', '/case/questionnaire'], async (req, res) => {
  const userId = 'dev-user';
  const { caseId } = req.query;
  if (!caseId) return res.status(400).json({ message: 'caseId required' });
  const c = await getCase(userId, caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  const data = c.questionnaire?.data || {};
  const missing = c.eligibility?.results ? aggregateMissing(c.eligibility.results) : [];
  res.json({
    caseId,
    questionnaire: {
      data,
      missingFieldsHint: missing,
      lastUpdated: c.questionnaire?.lastUpdated,
    },
    analyzerFields: c.analyzer?.fields,
    eligibility: c.eligibility?.results,
    documents: c.documents,
    status: c.status,
    requiredDocuments: c.requiredDocuments,
  });
});

router.post(['/questionnaire', '/case/questionnaire'], async (req, res) => {
  const userId = 'dev-user';
  let { caseId, answers, data } = req.body || {};
  let payload = {};
  if (answers && typeof answers === 'object') payload = answers;
  else if (data && typeof data === 'object') payload = data;
  let c;
  if (caseId) {
    c = await getCase(userId, caseId);
    if (!c) return res.status(404).json({ message: 'Case not found' });
  } else {
    caseId = await createCase(userId);
    c = await getCase(userId, caseId);
  }
  const existingFields = (c.analyzer && c.analyzer.fields) || {};
  const keyMap = {
    entityType: 'entity_type',
    employees: 'w2_employee_count',
    w2EmployeeCount: 'w2_employee_count',
    w2PartTimeCount: 'w2_part_time_count',
    payrollTotal: 'payroll_total',
    receivedPpp: 'received_ppp',
    revenueDropPercent: 'revenue_drop_percent',
    govShutdown: 'gov_shutdown',
    ownershipPercentage: 'ownership_percentage',
    ownerVeteran: 'owner_veteran',
    ownerSpouseVeteran: 'owner_spouse_veteran',
    ownerGender: 'owner_gender',
    ownerEthnicity: 'owner_ethnicity',
    yearEstablished: 'year_established',
    businessName: 'business_name',
    state: 'state',
    ruralArea: 'rural_area',
    opportunityZone: 'opportunity_zone',
  };
  const normalizedPayload = {};
  for (const [k, v] of Object.entries(payload)) {
    const key = keyMap[k] || k;
    normalizedPayload[key] = v;
  }
  const overriddenKeys = Object.keys(normalizedPayload).filter(
    (k) => k in existingFields
  );
  const merged = { ...existingFields, ...normalizedPayload };
  logger.info('merge: questionnaire overrides existing fields', {
    overriddenKeys,
    requestId: req.headers['x-request-id'],
  });
  const now = new Date().toISOString();
  const requiredDocuments = getRequiredDocuments({
    ...c,
    analyzer: { fields: merged },
    questionnaire: { data: payload },
  });
  await updateCase(caseId, {
    analyzer: { fields: merged, lastUpdated: now },
    questionnaire: { data: payload, lastUpdated: now },
    requiredDocuments,
  });
  const updated = await getCase(userId, caseId);
  const missing = updated.eligibility?.results
    ? aggregateMissing(updated.eligibility.results)
    : [];
  res.json({
    caseId,
    status: updated.status,
    analyzer: updated.analyzer,
    analyzerFields: updated.analyzer?.fields,
    eligibility: updated.eligibility,
    documents: updated.documents,
    requiredDocuments: updated.requiredDocuments,
    questionnaire: {
      data: payload,
      missingFieldsHint: missing,
      lastUpdated: now,
    },
  });
});

module.exports = router;
