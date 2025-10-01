const request = require("supertest");
process.env.SKIP_DB = "true";
global.pipelineFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
  headers: { get: () => "application/json" },
});
const app = require("../index");

afterAll(() => {
  delete global.pipelineFetch;
});

test("rejects unexpected evidence_key", async () => {
  const res = await request(app)
    .post("/api/files/upload")
    .field("grant_key", "business_tax_refund")
    .field("evidence_key", "not_allowed")
    .attach("file", Buffer.from("dummy"), "test.pdf");
  expect(res.status).toBe(400);
});

test("accepts expected evidence_key", async () => {
  const res = await request(app)
    .post("/api/files/upload")
    .field("grant_key", "business_tax_refund")
    .field("evidence_key", "tax_payment_proofs")
    .attach("file", Buffer.from("dummy"), "test.pdf");
  expect(res.status).toBe(200);
  expect(res.body.documents[0].evidence_key).toBe("tax_payment_proofs");
});

test("processes Tax_Payment_Receipt payload", async () => {
  global.pipelineFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      doc_type: "Tax_Payment_Receipt",
      fields: {
        confirmation_number: "ABC12345",
        payment_amount: "123.45",
        payment_date: "2023-04-15",
        payment_type: "federal",
      },
      doc_confidence: 0.9,
    }),
    headers: { get: () => "application/json" },
  });

  const res = await request(app)
    .post("/api/files/upload")
    .field("grant_key", "business_tax_refund")
    .attach("file", Buffer.from("dummy"), "receipt.pdf");
  expect(res.status).toBe(200);
  const doc = res.body.documents[0];
  expect(doc.doc_type).toBe("Tax_Payment_Receipt");
  expect(doc.analyzer_fields.payment_amount).toBe(123.45);
  expect(doc.analyzer_fields.payment_date).toBe("2023-04-15");
});

test("processes IRS_941X payload for erc", async () => {
  global.pipelineFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      doc_type: "IRS_941X",
      fields: { ein: "123456789", year: "2021", quarter: "1" },
      doc_confidence: 0.8,
    }),
    headers: { get: () => "application/json" },
  });

  const res = await request(app)
    .post("/api/files/upload")
    .field("grant_key", "erc")
    .attach("file", Buffer.from("dummy"), "941x.pdf");
  expect(res.status).toBe(200);
  const doc = res.body.documents[0];
  expect(doc.doc_type).toBe("IRS_941X");
  expect(doc.analyzer_fields.ein).toBe("123456789");
});

test('uploaded doc updates checklist status', async () => {
  global.pipelineFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      doc_type: 'IRS_941X',
      fields: { ein: '123456789', year: '2021', quarter: '1' },
    }),
    headers: { get: () => 'application/json' },
  });
  const { createCase, updateCase } = require('../utils/pipelineStore');
  const caseId = await createCase('dev-user');
  await updateCase(caseId, {
    eligibility: { results: [], requiredForms: [], requiredDocuments: [], shortlist: ['erc'] },
  });
  let res = await request(app).get(`/api/case/required-documents?caseId=${caseId}`);
  let item = res.body.required.find((d) => d.doc_type === 'IRS_941X');
  expect(item.status).toBe('not_uploaded');

  res = await request(app)
    .post('/api/files/upload')
    .field('caseId', caseId)
    .field('grant_key', 'erc')
    .attach('file', Buffer.from('dummy'), '941x.pdf');
  expect(res.status).toBe(200);

  res = await request(app).get(`/api/case/required-documents?caseId=${caseId}`);
  item = res.body.required.find((d) => d.doc_type === 'IRS_941X');
  expect(item.status).toBe('extracted');
});
