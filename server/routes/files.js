const express = require('express');
const multer = require('multer');

const auth = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const { getCase } = require('../utils/caseStore');

// @route   POST /api/files
// @desc    Upload a file
router.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const docKey = req.body.key;
  if (docKey) {
    const c = getCase(req.user.id, false);
    if (!c) return res.status(400).json({ message: 'No active case' });
    const doc = c.documents.find((d) => d.key === docKey);
    if (doc) {
      doc.uploaded = true;
      doc.url = `/uploads/${req.file.filename}`;
    }
  }

  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
  });
});

// Legacy fallback
router.post('/', auth, upload.single('file'), (req, res) => {
  req.body.key = req.body.key || '';
  const docKey = req.body.key;
  if (req.file && docKey) {
    const c = getCase(req.user.id, false);
    if (!c) return res.status(400).json({ message: 'No active case' });
    const doc = c.documents.find((d) => d.key === docKey);
    if (doc) {
      doc.uploaded = true;
      doc.url = `/uploads/${req.file.filename}`;
    }
  }
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ filename: req.file.filename, originalname: req.file.originalname, url: `/uploads/${req.file.filename}` });
});

module.exports = router;
