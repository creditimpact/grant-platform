const request = require('supertest');
const app = require('../index');
const Case = require('../models/Case');

describe('GET /api/case/required-documents', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns merged checklist with statuses', async () => {
    const mockCase = {
      caseId: 'CASE123',
      documents: [{ doc_type: 'IRS_941X', status: 'uploaded' }],
      eligibility: {
        results: [
          { key: 'erc', score: 90 },
          { key: 'business_tax_refund', score: 75 },
        ],
      },
    };

    jest.spyOn(Case, 'findOne').mockReturnValue({
      lean: () => Promise.resolve(mockCase),
    });

    const res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId: 'CASE123' });

    expect(res.status).toBe(200);
    expect(res.body.caseId).toBe('CASE123');
    expect(res.body.meta.shortlisted_grants).toEqual([
      'erc',
      'business_tax_refund',
    ]);

    const irs = res.body.required.find((d) => d.doc_type === 'IRS_941X');
    expect(irs.grants.sort()).toEqual(['business_tax_refund', 'erc']);
    expect(irs.status).toBe('uploaded');

    const receipt = res.body.required.find(
      (d) => d.doc_type === 'Tax_Payment_Receipt'
    );
    expect(receipt.source).toBe('grant');
    expect(receipt.grants).toEqual(['business_tax_refund']);
    expect(receipt.status).toBe('not_uploaded');
  });

  test('includes Articles_Of_Incorporation for incorporation grants', async () => {
    const mockCase = {
      caseId: 'CASE456',
      documents: [
        { doc_type: 'Articles_Of_Incorporation', status: 'uploaded' },
      ],
      eligibility: {
        results: [
          { key: 'california_small_biz', score: 90 },
          { key: 'urban_small_biz', score: 80 },
          { key: 'general_support', score: 70 },
        ],
      },
    };

    jest.spyOn(Case, 'findOne').mockReturnValue({
      lean: () => Promise.resolve(mockCase),
    });

    const res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId: 'CASE456' });

    expect(res.status).toBe(200);
    const docs = res.body.required.filter(
      (d) => d.doc_type === 'Articles_Of_Incorporation'
    );
    expect(docs).toHaveLength(1);
    const aoi = docs[0];
    expect(aoi.status).toBe('uploaded');
    expect(aoi.grants.sort()).toEqual([
      'california_small_biz',
      'general_support',
      'urban_small_biz',
    ]);
  });

  test('400 when caseId missing', async () => {
    const res = await request(app).get('/api/case/required-documents');
    expect(res.status).toBe(400);
  });

  test('404 when case not found', async () => {
    jest
      .spyOn(Case, 'findOne')
      .mockReturnValue({ lean: () => Promise.resolve(null) });

    const res = await request(app)
      .get('/api/case/required-documents')
      .query({ caseId: 'missing' });
    expect(res.status).toBe(404);
  });
});

