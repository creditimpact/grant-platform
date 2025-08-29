const express = require("express");
const router = express.Router();
const { getRequiredDocs } = require("../utils/documentLibrary");

router.get("/api/grants/:key/required-documents", (req, res) => {
  const items = getRequiredDocs(req.params.key);
  if (!items) return res.status(404).json({ error: "Unknown grant key" });
  res.json({ grant: req.params.key, required_documents: items });
});

module.exports = router;
