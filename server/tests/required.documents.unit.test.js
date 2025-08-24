const { getRequiredDocuments, ALWAYS_REQUIRED } = require('../utils/requiredDocuments');

describe('getRequiredDocuments', () => {
  test('returns always required documents', () => {
    const docs = getRequiredDocuments({ questionnaire: { data: {} } });
    ALWAYS_REQUIRED.forEach((d) => expect(docs).toContain(d));
  });

  test('adds ERC documents when employees > 0', () => {
    const c = { questionnaire: { data: { employees: 5 } } };
    const docs = getRequiredDocuments(c);
    expect(docs).toContain('Quarterly revenue statements (2020–2021)');
    expect(docs).toContain('Government shutdown orders (if applicable)');
  });

  test('adds veteran docs when ownerVeteran true', () => {
    const c = { questionnaire: { data: { ownerVeteran: true } } };
    const docs = getRequiredDocuments(c);
    expect(docs).toContain('DD214 (Proof of Veteran Status)');
  });
});
