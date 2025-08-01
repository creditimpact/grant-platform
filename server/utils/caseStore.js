const cases = {};

function computeDocuments(answers = {}) {
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
