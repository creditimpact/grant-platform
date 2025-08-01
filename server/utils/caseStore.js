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
    { key: 'id_document', name: 'ID Document', uploaded: false, url: '' },
    { key: 'tax_returns', name: 'Business Tax Returns', uploaded: false, url: '' },
    { key: 'bank_statements', name: 'Bank Statements', uploaded: false, url: '' },
  ];

  if (answers.businessType === 'Corporation' || answers.businessType === 'LLC') {
    docs.push({ key: 'incorporation_cert', name: 'Articles of Incorporation', uploaded: false, url: '' });
    docs.push({ key: 'ein_proof', name: 'EIN Confirmation', uploaded: false, url: '' });
  }

  if (answers.businessType === 'Sole') {
    docs.push({ key: 'business_license', name: 'Business License', uploaded: false, url: '' });
    docs.push({ key: 'ssn_verification', name: 'Owner SSN', uploaded: false, url: '' });
  }

  if (answers.employees && Number(answers.employees) > 0) {
    docs.push({ key: 'payroll_records', name: 'Payroll Records', uploaded: false, url: '' });
  }

  if (answers.cpaPrepared) {
    docs.push({ key: 'cpa_letter', name: 'CPA Letter', uploaded: false, url: '' });
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
