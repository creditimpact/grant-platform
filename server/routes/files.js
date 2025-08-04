const express = require('express');
const multer = require('multer');
const path = require('path');

const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Restrict uploads to known document/image types including PNG
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

// Keep original extension so the file can be served correctly
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage, fileFilter });
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
      doc.mimetype = req.file.mimetype;
      doc.originalname = req.file.originalname;
    }
  }

  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
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
      doc.mimetype = req.file.mimetype;
      doc.originalname = req.file.originalname;
    }
  }
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    url: `/uploads/${req.file.filename}`,
  });
});

module.exports = router;
