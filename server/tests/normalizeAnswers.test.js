const { normalizeAnswers } = require('../utils/normalizeAnswers');

describe('normalizeAnswers', () => {
  test('maps applicant_name from legal_business_name', () => {
    const out = normalizeAnswers({ legal_business_name: 'ACME' });
    expect(out.applicant_name).toBe('ACME');
  });
});
