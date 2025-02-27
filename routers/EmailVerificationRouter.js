// routes/EmailVerificationRouter.js
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/EmailVerificationController');

// Endpoint to send an OTP to the user's email
router.post('/sendOTP', sendOTP);

// Endpoint to verify the OTP entered by the user
router.post('/verifyOTP', verifyOTP);

module.exports = router;
