const request = require('supertest');
process.env.SKIP_DB = 'true';

global.pipelineFetch = jest.fn();
const app = require('../index');
const { getCase } = require('../utils/pipelineStore');

afterEach(() => {
  global.pipelineFetch.mockReset();
});

afterAll(() => {
  delete global.pipelineFetch;
});

test('parses bank statement from upload', async () => {
  const ocr = `Statement Period: Jan 1, 2024 through Jan 31, 2024\nAccount Number: XXXX4321\nBeginning Balance $100.00\nEnding Balance $150.00\nTotal Deposits $75.00\nTotal Withdrawals $25.00`;
  global.pipelineFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ocrText: ocr, fields: {}, fields_clean: {} }),
      headers: { get: () => 'application/json' },
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
      headers: { get: () => 'application/json' },
    });

  const res = await request(app)
    .post('/api/files/upload')
    .attach('file', Buffer.from('dummy'), 'stmt.pdf');

  expect(res.status).toBe(200);
  expect(res.body.analyzerFields.bank_statements[0].account_number_last4).toBe('4321');
  const c = await getCase('dev-user', res.body.caseId);
  expect(c.analyzer.fields.bank_statements[0].ending_balance).toBe(150);
});
