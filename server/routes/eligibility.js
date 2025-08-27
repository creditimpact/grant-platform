const express = require('express');
const fetchFn =
  global.pipelineFetch ||
  (global.fetch
    ? global.fetch.bind(global)
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, getCase, updateCase } = require('../utils/pipelineStore');
const { getServiceHeaders } = require('../utils/serviceHeaders');
const logger = require('../utils/logger');
const { getLatestTemplate, pdfTemplates } = require('../utils/formTemplates');
const { validateAgainstSchema } = require('../middleware/formValidation');
const { saveDraft } = require('../utils/drafts');
const { renderPdf } = require('../utils/pdfRenderer');
const { validateForm8974Calcs } = require('../utils/form8974');
const { validateForm6765Calcs } = require('../utils/form6765');

const router = express.Router();

const supportedForms = new Set([
  'form_424A',
  'form_6765',
  'form_8974',
  'form_RD_400_1',
  'form_RD_400_4',
  'form_RD_400_8',
  'form_sf424',
]);

const formNames = {
  form_424A: '424A Application',
  form_6765: 'Form 6765',
  form_8974: 'Form 8974',
  form_RD_400_1: 'RD 400-1',
  form_RD_400_4: 'RD 400-4',
  form_RD_400_8: 'RD 400-8',
  form_sf424: 'SF-424 Application',
};

const formMap = {
  '424A': 'form_424A',
  '6765': 'form_6765',
  '8974': 'form_8974',
  'RD-400-1': 'form_RD_400_1',
  'RD-400-4': 'form_RD_400_4',
  'RD-400-8': 'form_RD_400_8',
  'SF-424': 'form_sf424',
};

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
    incompleteForms: c.incompleteForms,
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
  const mappedForms = [];
  for (const f of requiredForms) {
    const normalized = formMap[f] || f;
    if (supportedForms.has(normalized)) {
      mappedForms.push(normalized);
    } else {
      logger.warn('unsupported_form', { formId: f, requestId: req.id });
    }
  }

  const eligibility = {
    results,
    requiredForms: mappedForms,
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
  const incompleteForms = [];
  const logFn = logger.debug ? logger.debug.bind(logger) : logger.info.bind(logger);
  await Promise.all(
    mappedForms.map(async (formName) => {
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
        const required = pdfTemplates[formName]?.required || [];
        const missingRequired = required.filter(
          (k) =>
            formData[k] === undefined ||
            formData[k] === null ||
            formData[k] === ''
        );
        const validationErrors = tmpl
          ? validateAgainstSchema(formData, tmpl.schema)
          : [];
        const missingFields = [
          ...missingRequired,
          ...validationErrors
            .filter((e) => e.message === 'required')
            .map((e) => e.field),
        ];
        if (missingFields.length) {
          logger.error('form_fill_validation_failed', {
            formId: formName,
            requestId: req.id,
            missingKeys: missingFields,
            caseId,
          });
          incompleteForms.push({
            formId: formName,
            formKey: formName,
            version,
            missingFields,
            message: `Missing required fields: ${missingFields.join(', ')}`,
            name: formNames[formName] || formName,
          });
          return;
        }
        if (formName === 'form_8974') {
          const calcMismatch = validateForm8974Calcs(formData);
          if (calcMismatch.length) {
            logger.error('form_fill_calculation_mismatch', {
              formId: formName,
              requestId: req.id,
              missingKeys: calcMismatch,
              caseId,
            });
            incompleteForms.push({
              formId: formName,
              formKey: formName,
              version,
              missingFields: calcMismatch,
              message: `Calculation mismatch: ${calcMismatch.join(', ')}`,
              name: formNames[formName] || formName,
            });
            return;
          }
        } else if (formName === 'form_6765') {
          const calcMismatch = validateForm6765Calcs(formData);
          if (calcMismatch.length) {
            logger.error('form_fill_calculation_mismatch', {
              formId: formName,
              requestId: req.id,
              missingKeys: calcMismatch,
              caseId,
            });
            incompleteForms.push({
              formId: formName,
              formKey: formName,
              version,
              missingFields: calcMismatch,
              message: `Calculation mismatch: ${calcMismatch.join(', ')}`,
              name: formNames[formName] || formName,
            });
            return;
          }
        }
        let url;
        logger.info('form_fill_received', {
          formId: formName,
          hasFilledForm: true,
          caseId,
          requestId: req.id,
        });

        let buffer;
        try {
          logger.info('pdf_render_started', {
            formId: formName,
            caseId,
            requestId: req.id,
          });
          buffer = await renderPdf({ formId: formName, filledForm: formData });
          const valid =
            buffer.length > 0 &&
            buffer.slice(0, 5).toString() === '%PDF-' &&
            buffer.includes('%%EOF');
          if (!valid) throw new Error('invalid_pdf');
          logger.info('pdf_render_succeeded', {
            formId: formName,
            caseId,
            size: buffer.length,
            requestId: req.id,
          });
          url = await saveDraft(caseId, formName, buffer, req);
        } catch (err) {
          logger.error('pdf_render_failed', {
            formId: formName,
            caseId,
            error: err.stack || String(err),
            requestId: req.id,
          });
        }
        filledForms.push({
          formId: formName,
          formKey: formName,
          version,
          data: formData,
          url,
          name: formNames[formName] || formName,
        });
      } catch (err) {
        logger.error('form_fill_failed', {
          formId: formName,
          requestId: req.id,
          error: err.stack,
        });
      }
    })
  );
  await updateCase(caseId, { generatedForms: filledForms, incompleteForms });
  const c = await getCase(userId, caseId);
  const missing = aggregateMissing(results);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[eligibility] normalized results', {
      count: results.length,
      requiredForms: mappedForms,
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
    incompleteForms: c.incompleteForms,
  });
});

module.exports = router;
