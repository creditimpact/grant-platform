const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const createAgent = require('./tlsAgent');
const Case = require('../models/Case');
const logger = require('./logger');

function loadGrantConfig() {
  const configPath = path.join(__dirname, '../../eligibility-engine/grants_config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const clean = raw.startsWith('//') ? raw.split('\n').slice(1).join('\n') : raw;
  return JSON.parse(clean);
}

const agent = createAgent();

async function computeDocuments(answers = {}) {
  const docs = [
    {
      key: 'business_tax_returns',
      name: 'Business Tax Returns',
      required: true,
      uploaded: false,
      url: '',
    },
    {
      key: 'financial_statements',
      name: 'Financial Statements (P&L, Balance Sheet)',
      required: true,
      uploaded: false,
      url: '',
    },
    {
      key: 'bank_statements',
      name: 'Bank Statements',
      required: true,
      uploaded: false,
      url: '',
    },
    {
      key: 'business_registration',
      name: 'Business Registration/License',
      required: true,
      uploaded: false,
      url: '',
    },
    {
      key: 'lease_or_deed',
      name: 'Lease Agreement/Deed',
      required: false,
      uploaded: false,
      url: '',
    },
    {
      key: 'business_plan',
      name: 'Business Plan',
      required: false,
      uploaded: false,
      url: '',
    },
    {
      key: 'owner_resume',
      name: "Owner's Resume",
      required: false,
      uploaded: false,
      url: '',
    },
    {
      key: 'insurance_certificate',
      name: 'Business Insurance Certificate',
      required: true,
      uploaded: false,
      url: '',
    },
  ];

  if (answers.businessType === 'Corporation' || answers.businessType === 'LLC') {
    docs.push({
      key: 'articles_incorporation',
      name: 'Articles of Incorporation',
      required: true,
      uploaded: false,
      url: '',
    });
    docs.push({
      key: 'ein_document',
      name: 'EIN / Tax ID Confirmation',
      required: true,
      uploaded: false,
      url: '',
    });
  }

  if (answers.numberOfEmployees && Number(answers.numberOfEmployees) > 0) {
    docs.push({
      key: 'payroll_records',
      name: 'Payroll Records',
      required: false,
      uploaded: false,
      url: '',
    });
  }

  if (answers.previousGrants) {
    docs.push({
      key: 'previous_grant_docs',
      name: 'Previous Grant Documents',
      required: false,
      uploaded: false,
      url: '',
    });
  }

  try {
    const config = loadGrantConfig();
    const baseUrl = process.env.ELIGIBILITY_ENGINE_URL || 'https://localhost:4001';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
      agent,
    });
    const results = await response.json();
    if (Array.isArray(results)) {
      results
        .filter((r) => r.eligible || r.score > 0)
        .forEach((r) => {
          const grant = Object.values(config).find((g) => g.name === r.name);
          if (grant && grant.required_documents) {
            Object.values(grant.required_documents).flat().forEach((name) => {
              const key = name.toLowerCase().replace(/\s+/g, '_');
              if (!docs.some((d) => d.key === key)) {
                docs.push({ key, name, uploaded: false, url: '' });
              }
            });
          }
        });
    }
  } catch (err) {
    logger.error('compute_documents_failed', { error: err.message });
  }

  return docs;
}

async function getCase(userId, createIfMissing = true) {
  let c = await Case.findOne({ userId });
  if (!c && createIfMissing) {
    c = await Case.create({ userId });
  }
  return c;
}

async function createCase(userId) {
  return getCase(userId, true);
}

module.exports = { getCase, createCase, computeDocuments };
