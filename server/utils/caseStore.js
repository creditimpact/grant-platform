const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const cases = {};

function loadGrantConfig() {
  const configPath = path.join(__dirname, '../../eligibility-engine/grants_config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  // remove leading comment line if present
  const clean = raw.startsWith('//') ? raw.split('\n').slice(1).join('\n') : raw;
  return JSON.parse(clean);
}

async function computeDocuments(answers = {}) {
  const docs = [
    {
      key: 'id_document',
      name: 'ID Document',
      reason: 'Verify applicant identity',
      uploaded: false,
      url: '',
    },
    {
      key: 'tax_returns',
      name: 'Business Tax Returns',
      reason: 'Confirm revenue and profit',
      uploaded: false,
      url: '',
    },
    {
      key: 'bank_statements',
      name: 'Bank Statements',
      reason: 'Validate cash flow',
      uploaded: false,
      url: '',
    },
  ];

  if (answers.businessType === 'Corporation' || answers.businessType === 'LLC') {
    docs.push({
      key: 'incorporation_cert',
      name: 'Articles of Incorporation',
      reason: 'Required for corporations and LLCs',
      uploaded: false,
      url: '',
    });
    docs.push({
      key: 'ein_proof',
      name: 'EIN Confirmation',
      reason: 'Verify business EIN',
      uploaded: false,
      url: '',
    });
  }

  if (answers.businessType === 'Sole') {
    docs.push({
      key: 'business_license',
      name: 'Business License',
      reason: 'Required for sole proprietors',
      uploaded: false,
      url: '',
    });
    docs.push({
      key: 'ssn_verification',
      name: 'Owner SSN',
      reason: 'Verify owner SSN',
      uploaded: false,
      url: '',
    });
  }

  if ((answers.employees && Number(answers.employees) > 0) || answers.hasPayroll) {
    docs.push({
      key: 'payroll_records',
      name: 'Payroll Records',
      reason: 'Confirm payroll details',
      uploaded: false,
      url: '',
    });
  }

  if (answers.cpaPrepared) {
    docs.push({
      key: 'cpa_letter',
      name: 'CPA Letter',
      reason: 'Proof of CPA prepared financials',
      uploaded: false,
      url: '',
    });
  }

  if (answers.minorityOwned) {
    docs.push({
      key: 'minority_cert',
      name: 'Minority Ownership Certificate',
      reason: 'Required for minority-owned businesses',
      uploaded: false,
      url: '',
    });
  }

  if (answers.womanOwned) {
    docs.push({
      key: 'woman_cert',
      name: 'Woman Ownership Certificate',
      reason: 'Required for woman-owned businesses',
      uploaded: false,
      url: '',
    });
  }

  if (answers.veteranOwned) {
    docs.push({
      key: 'veteran_proof',
      name: 'Veteran Service Proof',
      reason: 'Required for veteran-owned businesses',
      uploaded: false,
      url: '',
    });
  }

  if (answers.hasInsurance) {
    docs.push({
      key: 'insurance_cert',
      name: 'Insurance Certificate',
      reason: 'Show active business insurance',
      uploaded: false,
      url: '',
    });
  }

  if (answers.previousGrants === 'yes') {
    docs.push({
      key: 'previous_grant_docs',
      name: 'Previous Grant Documents',
      reason: 'Review past grant awards',
      uploaded: false,
      url: '',
    });
  }

  // Append grant-specific document requirements
  try {
    const config = loadGrantConfig();
    const engineUrl = process.env.ENGINE_URL || 'http://localhost:4001/check';
    const response = await fetch(engineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
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
    console.error('computeDocuments failed:', err.message);
  }

  return docs;
}

function getCase(userId, createIfMissing = true) {
  if (!cases[userId]) {
    if (!createIfMissing) return null;
    cases[userId] = {
      status: 'Open',
      answers: {},
      documents: [],
      eligibility: null,
    };
  }
  return cases[userId];
}

function createCase(userId) {
  return getCase(userId, true);
}

module.exports = { cases, getCase, createCase, computeDocuments };
