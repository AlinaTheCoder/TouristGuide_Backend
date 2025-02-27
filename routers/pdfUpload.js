const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinaryConfig');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.body.fileData) {
      return res.status(400).json({ error: 'No file data received' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:application/pdf;base64,${req.body.fileData}`,
      {
        resource_type: 'raw',
        folder: 'touristguide/certificates',
        public_id: `certificate_${Date.now()}`,
        format: 'pdf'
      }
    );

    res.json({ url: result.secure_url });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;