const express = require('express');
const fetchFn =
  global.pipelineFetch ||
  (global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const { getServiceHeaders } = require('../utils/serviceHeaders');
const logger = require('../utils/logger');
const { getLatestTemplate } = require('../utils/formTemplates');
const { validateAgainstSchema } = require('../middleware/formValidation');

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
  let analyzerFields = {};
  if (caseId) {
    const c = await getCase(userId, caseId);
    if (!c) return res.status(404).json({ message: 'Case not found' });
    analyzerFields = c.analyzer?.fields || {};
    base = { ...analyzerFields, ...payload };
  } else {
    caseId = await createCase(userId);
  }

  const engineBase = process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
  const engineUrl = `${engineBase.replace(/\/$/, '')}/check`;
  let resp;
  try {
    resp = await fetchFn(engineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getServiceHeaders('ELIGIBILITY_ENGINE', req),
      },
      body: JSON.stringify(base),
    });
  } catch (err) {
    logger.error('eligibility_engine_unreachable', {
      error: err.stack,
      requestId: req.id,
    });
    return res
      .status(502)
      .json({ message: 'Eligibility engine unreachable' });
  }
  if (!resp.ok) {
    const text = await resp.text();
    console.error('[eligibility] engine non-200', resp.status, text);
    return res
      .status(502)
      .json({ message: 'Eligibility engine error', details: text });
  }

  const body = await resp.json();

  // Normalize results to an array
  const results = Array.isArray(body)
    ? body
    : Array.isArray(body?.results)
        ? body.results
        : [];

  // Envelope-level required forms
  const envForms = Array.isArray(body?.requiredForms) ? body.requiredForms : [];

  // Flatten result-level required forms
  const perResultForms = results.flatMap((r) =>
    Array.isArray(r?.requiredForms) ? r.requiredForms : []
  );

  // Final aggregation (unique, preserve order)
  const requiredForms = [...new Set([...envForms, ...perResultForms])];

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
  const agentBase = process.env.AI_AGENT_URL || 'http://localhost:5001';
  const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
  const filledForms = [];
  const logFn = logger.debug ? logger.debug.bind(logger) : logger.info.bind(logger);
  await Promise.all(
    requiredForms.map(async (formName) => {
      logFn('form_fill_attempt', { formId: formName, requestId: req.id });
      try {
        const agentResp = await fetchFn(agentUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getServiceHeaders('AI_AGENT', req),
          },
          body: JSON.stringify({
            form_name: formName,
            user_payload: base,
            analyzer_fields: analyzerFields,
          }),
        });
        if (!agentResp.ok) {
          const text = await agentResp.text();
          logger.error('form_fill_failed', {
            formId: formName,
            requestId: req.id,
            status: agentResp.status,
            error: text,
          });
          return;
        }
        const agentData = await agentResp.json();
        const tmpl = await getLatestTemplate(formName);
        const version = tmpl ? tmpl.version : 1;
        const formData = agentData.filled_form || agentData;
        const validationErrors = tmpl
          ? validateAgainstSchema(formData, tmpl.schema)
          : [];
        if (validationErrors.length) {
          logger.error('form_fill_validation_failed', {
            formId: formName,
            requestId: req.id,
            errors: validationErrors,
          });
          return;
        }
        filledForms.push({ formKey: formName, version, data: formData });
      } catch (err) {
        logger.error('form_fill_failed', {
          formId: formName,
          requestId: req.id,
          error: err.stack,
        });
      }
    })
  );
  await updateCase(caseId, { generatedForms: filledForms });
  const c = await getCase(userId, caseId);
  const missing = aggregateMissing(results);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[eligibility] normalized results', {
      count: results.length,
      requiredForms,
    });
  }
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
