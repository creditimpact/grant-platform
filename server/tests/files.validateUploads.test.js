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
  expect(doc.docType).toBe("Tax_Payment_Receipt");
  expect(doc.fields.payment_amount).toBe(123.45);
  expect(doc.fields.payment_date).toBe("2023-04-15");
});
