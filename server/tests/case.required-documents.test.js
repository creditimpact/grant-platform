const request = require('supertest');
process.env.SKIP_DB = 'true';
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

describe('GET /api/case/required-documents', () => {
  beforeEach(() => {
    resetStore();
  });

  test('builds checklist for single grant shortlist', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, {
      eligibility: { results: [], requiredForms: [], shortlist: ['business_tax_refund'] },
    });
    const res = await request(app).get(`/api/case/required-documents?caseId=${caseId}`);
    expect(res.status).toBe(200);
    const docs = res.body.required;
    const keys = docs.map((d) => d.doc_type);
    expect(keys).toContain('Tax_Payment_Receipt'); // common doc
    expect(keys).toContain('tax_payment_proofs'); // grant specific
    const receipt = docs.find((d) => d.doc_type === 'Tax_Payment_Receipt');
    expect(receipt.status).toBe('not_uploaded');
  });

  test('deduplicates docs across multiple grants', async () => {
    const caseId = await createCase('dev-user');
    await updateCase(caseId, {
      eligibility: { results: [], requiredForms: [], shortlist: ['business_tax_refund', 'erc'] },
    });
    const res = await request(app).get(`/api/case/required-documents?caseId=${caseId}`);
    expect(res.status).toBe(200);
    const docs = res.body.required;
    const count941 = docs.filter((d) => d.doc_type === 'IRS_941X').length;
    expect(count941).toBe(1); // deduped
  });

  test('404 when case not found', async () => {
    const res = await request(app).get('/api/case/required-documents?caseId=missing');
    expect(res.status).toBe(404);
  });
});
