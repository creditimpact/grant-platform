const express = require('express');
const multer = require('multer');

const auth = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// @route   POST /api/files
// @desc    Upload a file
router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ filename: req.file.filename, originalname: req.file.originalname });
});

module.exports = router;
