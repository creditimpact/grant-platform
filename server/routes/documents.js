const express = require("express");
const router = express.Router();
const { getRequiredDocs } = require("../utils/documentLibrary");
const { getCase, updateCase } = require("../utils/pipelineStore");

router.get("/api/grants/:key/required-documents", async (req, res) => {
  let caseDocs = [];
  if (req.query.caseId) {
    const c = await getCase("dev-user", req.query.caseId);
    if (!c) return res.status(404).json({ error: "Case not found" });
    caseDocs = c.documents || [];
  }
  const items = getRequiredDocs(req.params.key, caseDocs);
  if (!items) return res.status(404).json({ error: "Unknown grant key" });
  res.json({ grant: req.params.key, required_documents: items });
});

router.post("/api/cases/:caseId/documents", async (req, res) => {
  const userId = "dev-user";
  const { caseId } = req.params;
  const c = await getCase(userId, caseId);
  if (!c) return res.status(404).json({ error: "Case not found" });
  const doc = {
    docType: req.body.docType,
    fields: req.body.fields || {},
    fileUrl: req.body.fileUrl,
    uploadedAt: req.body.uploadedAt || new Date().toISOString(),
    requestId: req.body.requestId,
  };
  const documents = [...(c.documents || []), doc];
  await updateCase(caseId, { documents });
  res.json({ ok: true });
});

module.exports = router;
