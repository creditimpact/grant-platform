const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetchFn = global.pipelineFetch || (global.fetch ? global.fetch.bind(global) : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
const { createCase, updateCase, getCase } = require('../utils/pipelineStore');
const logger = require('../utils/logger');
const { validate, schemas } = require('../middleware/validate');
const { getLatestTemplate, pdfTemplates } = require('../utils/formTemplates');
const { validateAgainstSchema } = require('../middleware/formValidation');
const { getServiceHeaders } = require('../utils/serviceHeaders');
const { saveDraft } = require('../utils/drafts');
const { renderPdf } = require('../utils/pdfRenderer');
const { validateForm8974Calcs } = require('../utils/form8974');
const { validateForm6765Calcs } = require('../utils/form6765');
const { normalizeList } = require('../utils/documentAliases');
const {
  normalizeAnswers,
  toMMDDYYYY,
  toNumber,
  currency,
} = require('../utils/normalizeAnswers');
const {
  mapSF424,
  mapSF424A,
  mapRD400_1,
  mapRD400_4,
  mapRD400_8,
  map8974,
  map6765,
} = require('../utils/formMappers');
const { preferCleanFields } = require('../utils/preferCleanFields');

function mapForForm(formId, answers, { testMode = false } = {}) {
  switch (formId) {
    case 'form_sf424':
      return { ...answers, ...mapSF424(answers, { testMode }) };
    case 'form_sf424a':
      return { ...answers, ...mapSF424A(answers) };
    case 'form_rd400_1':
      return { ...answers, ...mapRD400_1(answers) };
    case 'form_rd400_4':
      return { ...answers, ...mapRD400_4(answers) };
    case 'form_rd400_8':
      return { ...answers, ...mapRD400_8(answers) };
    case 'form_8974':
      return { ...answers, ...map8974(answers) };
    case 'form_6765':
      return { ...answers, ...map6765(answers) };
    default:
      return answers;
  }
}

const router = express.Router();

const formNames = {
  form_424A: '424A Application',
  form_6765: 'Form 6765',
  form_8974: 'Form 8974',
  form_RD_400_1: 'RD 400-1',
  form_RD_400_4: 'RD 400-4',
  form_RD_400_8: 'RD 400-8',
  form_sf424: 'SF-424 Application',
};

function aggregateMissing(results) {
  return [...new Set(results.flatMap((r) => r.missing_fields || []))];
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post('/submit-case', upload.any(), validate(schemas.pipelineSubmit), async (req, res) => {
  const userId = 'dev-user';
  const { caseId: providedCaseId, ...basePayload } = req.body;
  const caseId = await createCase(userId, providedCaseId);
  try {
    const docMeta = req.files.map((f) => ({
      originalname: f.originalname,
      path: f.path,
      mimetype: f.mimetype,
      size: f.size,
    }));
    await updateCase(caseId, { documents: docMeta });

    const analyzerBase = process.env.AI_ANALYZER_URL || 'http://localhost:8002';
    const analyzerUrl = `${analyzerBase.replace(/\/$/, '')}/analyze`;
    let extracted = {};
    for (const file of req.files) {
      const form = new FormData();
      form.append('file', fs.createReadStream(file.path), file.originalname);
      const resp = await fetchFn(analyzerUrl, {
        method: 'POST',
        body: form,
        headers: { ...form.getHeaders(), ...getServiceHeaders('AI_ANALYZER', req) },
      });
      if (!resp.ok) {
        const text = await resp.text();
        await updateCase(caseId, { status: 'error', error: text });
        return res.status(502).json({ message: `AI analyzer error ${resp.status}`, details: text });
      }
      const analysis = await resp.json();
      const fields = preferCleanFields(analysis);
      extracted = { ...extracted, ...fields };
    }
    const overrideKeys = Object.keys(basePayload).filter((key) =>
      Object.prototype.hasOwnProperty.call(extracted, key)
    );
    if (overrideKeys.length) {
      logger.debug(`Overriding analyzer fields: ${overrideKeys.join(', ')}`);
    }
    const normalized = normalizeAnswers({ ...extracted, ...basePayload });
    await updateCase(caseId, { status: 'analyzed', normalized, analyzer: extracted });

    if (
      !normalized ||
      typeof normalized !== 'object' ||
      Object.keys(normalized).length === 0
    ) {
      return res.status(400).json({ message: 'Missing eligibility payload' });
    }

    const BASE = process.env.ELIGIBILITY_ENGINE_URL || 'http://localhost:4001';
    const PATH = process.env.ELIGIBILITY_ENGINE_PATH || '/check';
    const engineUrl = new URL(PATH, BASE).toString();
    const url = engineUrl;
    const payload = normalized;
    console.log('[eligibility] engine url', url, 'payload keys', Object.keys(payload));

    logger.info('eligibility_engine_request', {
      url: engineUrl,
      payload: normalized,
      requestId: req.id,
    });
    const eligResp = await fetchFn(engineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getServiceHeaders('ELIGIBILITY_ENGINE', req),
      },
      body: JSON.stringify(normalized),
    });
    if (!eligResp.ok) {
      const text = await eligResp.text();
      console.error('[eligibility] engine non-200', eligResp.status, text);
      await updateCase(caseId, { status: 'error', error: text });
      return res.status(502).json({ message: `Eligibility engine error ${eligResp.status}`, details: text });
    }
    const rawEligibility = await eligResp.json();
    const normalizedEligibility = Array.isArray(rawEligibility)
      ? rawEligibility
      : {
          ...rawEligibility,
          requiredForms: normalizeList(rawEligibility.required_forms || []),
          requiredDocuments: normalizeList(rawEligibility.required_documents || []),
        };
    await updateCase(caseId, { status: 'checked', eligibility: normalizedEligibility });

    const eligibilityResults = Array.isArray(normalizedEligibility)
      ? normalizedEligibility
      : normalizedEligibility.results || [];

    const requiredForms = Array.isArray(normalizedEligibility)
      ? normalizeList(eligibilityResults.flatMap((r) => r.required_forms || []))
      : normalizeList(normalizedEligibility.requiredForms || []);

    const eligibility = normalizedEligibility;

    const agentBase = process.env.AI_AGENT_URL || 'http://localhost:5001';
    const agentUrl = `${agentBase.replace(/\/$/, '')}/form-fill`;
    const filledForms = [];
    const incompleteForms = [];
    for (const formName of requiredForms) {
      // Pre-mapping diagnostics to trace input → mapper
      logger.info('form_fill_inputs_preview', {
        formId: formName,
        requestId: req.id,
        preMapKeys: Object.keys(normalized).sort(),
        projectTitle: normalized.projectTitle,
        descriptive_title: normalized.descriptive_title,
      });
      const payload = mapForForm(formName, normalized, {
        testMode: process.env.PROCESS_TEST_MODE === 'true',
      });
      logger.info('form_fill_payload_preview', {
        formId: formName,
        payloadKeys: Object.keys(payload).sort(),
        preview: {
          applicant_legal_name: payload.applicant_legal_name,
          ein: payload.ein,
          descriptive_title: payload.descriptive_title,
          project_start_date: payload.project_start_date,
          project_end_date: payload.project_end_date,
          funding_total: payload.funding_total,
          authorized_rep_name: payload.authorized_rep_name,
          authorized_rep_title: payload.authorized_rep_title,
          authorized_rep_date_signed: payload.authorized_rep_date_signed,
        },
      });
      const agentResp = await fetchFn(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getServiceHeaders('AI_AGENT', req) },
        body: JSON.stringify({
          form_name: formName,
          user_payload: payload,
          analyzer_fields: extracted,
        }),
      });
      if (!agentResp.ok) {
        const text = await agentResp.text();
        await updateCase(caseId, { status: 'error', error: text });
        return res
          .status(502)
          .json({ message: `AI agent form-fill error ${agentResp.status}`, details: text });
      }
      const agentData = await agentResp.json();
      const tmpl = await getLatestTemplate(formName);
      const version = tmpl ? tmpl.version : 1;
      const formData = {
        ...payload,
        ...(agentData.filled_form || agentData),
      };
      const required = pdfTemplates[formName]?.required || [];
      const missingRequired = required.filter(
        (k) =>
          formData[k] === undefined ||
          formData[k] === null ||
          formData[k] === ''
      );
      const validationErrors = tmpl ? validateAgainstSchema(formData, tmpl.schema) : [];
      const missingFields = [
        ...missingRequired,
        ...validationErrors.filter((e) => e.message === 'required').map((e) => e.field),
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
        continue;
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
          continue;
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
          continue;
        }
      }
      logger.info('form_fill_received', {
        formId: formName,
        hasFilledForm: true,
        caseId,
        requestId: req.id,
      });

      let buffer;
      let url;
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
    }
    await updateCase(caseId, {
      status: incompleteForms.length ? 'incomplete' : 'forms_filled',
      generatedForms: filledForms,
      incompleteForms,
    });

    const pendingForms = requiredForms.filter(
      (formId) => !filledForms.some((f) => f.formId === formId)
    );

    res.json({
      caseId,
      eligibility,
      generatedForms: filledForms,
      incompleteForms,
      pendingForms,
    });
  } catch (err) {
    for (const f of req.files || []) fs.unlink(f.path, () => {});
    await updateCase(caseId, { status: 'error', error: err.message });
    res.status(500).json({ message: err.message, error: err.message });
  }
});

router.get('/status/:caseId', async (req, res) => {
  const userId = 'dev-user';
  const c = await getCase(userId, req.params.caseId);
  if (!c) return res.status(404).json({ message: 'Case not found' });
  const missing = c.eligibility?.results
    ? aggregateMissing(c.eligibility.results)
    : [];
  res.json({
    caseId: c.caseId,
    createdAt: c.createdAt,
    status: c.status,
    analyzer: c.analyzer,
    analyzerFields: preferCleanFields(c.analyzer || {}),
    questionnaire: {
      data: c.questionnaire?.data || {},
      missingFieldsHint: missing,
      lastUpdated: c.questionnaire?.lastUpdated,
    },
    eligibility: c.eligibility,
    generatedForms: c.generatedForms,
    incompleteForms: c.incompleteForms,
    documents: c.documents,
    normalized: c.normalized,
  });
});

module.exports = router;
