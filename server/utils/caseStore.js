const cases = {};

function getCase(userId) {
  if (!cases[userId]) {
    cases[userId] = {
      status: 'Open',
      documents: [
        { key: 'id_document', name: 'ID Document', uploaded: false, url: '' },
        { key: 'financials', name: 'Financial Statements', uploaded: false, url: '' },
      ],
      eligibility: null,
    };
  }
  return cases[userId];
}

module.exports = { cases, getCase };
