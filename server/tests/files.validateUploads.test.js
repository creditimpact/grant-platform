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
