const request = require("supertest");
process.env.SKIP_DB = "true";
const app = require("../index");
const { createCase } = require("../utils/pipelineStore");

test("returns required docs for business_tax_refund", async () => {
  const res = await request(app).get(
    "/api/grants/business_tax_refund/required-documents"
  );
  expect(res.status).toBe(200);
  expect(res.body.required_documents.length).toBeGreaterThan(1);
  expect(res.body.required_documents[0]).toHaveProperty("key");
});

test("includes Articles_Of_Incorporation for business_tax_refund", async () => {
  const res = await request(app).get(
    "/api/grants/business_tax_refund/required-documents"
  );
  expect(res.status).toBe(200);
  const item = res.body.required_documents.find(
    (d) => d.doc_type === "Articles_Of_Incorporation"
  );
  expect(item).toBeDefined();
  expect(item.min_count).toBe(1);
});

test("marks Tax_Payment_Receipt as fulfilled", async () => {
  const caseId = await createCase("dev-user");
  await request(app)
    .post(`/api/cases/${caseId}/documents`)
    .send({
      docType: "Tax_Payment_Receipt",
      fields: {
        confirmation_number: "ABC12345",
        payment_amount: 100,
        payment_date: "2023-04-15",
        payment_type: "federal",
      },
      fileUrl: "receipt.pdf",
    });
  const res = await request(app).get(
    `/api/grants/business_tax_refund/required-documents?caseId=${caseId}`
  );
  expect(res.status).toBe(200);
  const item = res.body.required_documents.find(
    (d) => d.doc_type === "Tax_Payment_Receipt"
  );
  expect(item.fulfilled).toBe(true);
  expect(item.uploads.length).toBe(1);
});
