const request = require("supertest");
process.env.SKIP_DB = "true";
const app = require("../index");

test("returns required docs for business_tax_refund", async () => {
  const res = await request(app).get(
    "/api/grants/business_tax_refund/required-documents"
  );
  expect(res.status).toBe(200);
  expect(res.body.required_documents.length).toBeGreaterThan(1);
  expect(res.body.required_documents[0]).toHaveProperty("key");
});
