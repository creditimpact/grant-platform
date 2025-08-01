const cases = {};

function computeDocuments(answers = {}) {
  const docs = [
    { key: 'id_document', name: 'ID Document', uploaded: false, url: '' },
    { key: 'financials', name: 'Financial Statements', uploaded: false, url: '' },
  ];

  if (answers.businessType === 'Corporation') {
    docs.push({ key: 'incorporation_cert', name: 'Articles of Incorporation', uploaded: false, url: '' });
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
