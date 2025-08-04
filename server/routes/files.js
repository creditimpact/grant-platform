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
    if (!doc) return res.status(400).json({ message: 'Unknown document key' });

    const answers = c.answers || {};
    let mismatch = '';
    const name = (answers.businessName || '').toLowerCase().replace(/\s+/g, '');
    if ((docKey === 'incorporation_cert' || docKey === 'business_license') && name) {
      if (!req.file.originalname.toLowerCase().includes(name)) {
        mismatch = 'Business name mismatch';
      }
    }
    if (docKey === 'ein_proof' && answers.ein) {
      const digits = answers.ein.replace(/\D/g, '').slice(-4);
      if (digits && !req.file.originalname.includes(digits)) {
        mismatch = 'EIN mismatch';
      }
    }
    if (docKey === 'minority_cert' && !answers.minorityOwned) {
      mismatch = 'Minority ownership not indicated in questionnaire';
    }
    if (docKey === 'woman_cert' && !answers.womanOwned) {
      mismatch = 'Women ownership not indicated in questionnaire';
    }
    if (docKey === 'veteran_proof' && !answers.veteranOwned) {
      mismatch = 'Veteran ownership not indicated in questionnaire';
    }
    if (docKey === 'insurance_cert' && !answers.hasInsurance) {
      mismatch = 'Insurance not indicated in questionnaire';
    }
    if (mismatch) {
      return res.status(400).json({ message: mismatch });
    }

    doc.uploaded = true;
    doc.url = `/uploads/${req.file.filename}`;
    doc.mimetype = req.file.mimetype;
    doc.originalname = req.file.originalname;
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
