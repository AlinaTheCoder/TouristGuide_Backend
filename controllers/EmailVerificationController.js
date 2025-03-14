// controllers/EmailVerificationController.js
const nodemailer = require('nodemailer');
const { db, admin } = require('../config/db');
const logger = require('../middleware/logger'); 

// -----------------------------------------------------------------------
// Helper: Sanitize email to use as a Firebase key (Firebase keys cannot include ".")
function sanitizeEmail(email) {
  return email.replace(/\./g, ',');
}

// -----------------------------------------------------------------------
// Configure nodemailer transporter (using Gmail as an example)
// IMPORTANT: Set process.env.EMAIL_USER and process.env.EMAIL_PASS in your environment
const transporter = nodemailer.createTransport({
  service: 'Gmail', // You can change this to your email service provider
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});

// -----------------------------------------------------------------------
// Helper: Generate a 4-digit OTP code as a string
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// -----------------------------------------------------------------------
// Controller: sendOTP
// This endpoint accepts an email in the request body, first checks if the email is already registered,
// and if not, generates an OTP, stores it in the database with a 10-minute expiration,
// and sends it to the user's email.
const sendOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    logger.error('[sendOTP] No email provided.');
    return res.status(400).send({ error: 'Email is required.' });
  }

  // -----------------------------------------------------------------------
  // Check if the email is already registered in Firebase Authentication
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    if (userRecord) {
      logger.error(`[sendOTP] Email already exists: ${email}`);
      return res
        .status(400)
        .send({ error: 'Email already exists. Please use a different email.' });
    }
  } catch (err) {
    // If error code is 'auth/user-not-found', then it's OK to proceed.
    if (err.code !== 'auth/user-not-found') {
      logger.error(`[sendOTP] Error checking email existence: ${err.message}`);
      return res.status(500).send({ error: 'Error checking email existence.' });
    }
    // Else, no user exists—proceed with OTP generation.
  }

  // -----------------------------------------------------------------------
  // Generate OTP and save it with expiration time
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes
  const sanitizedEmail = sanitizeEmail(email);
  const otpRef = db.ref(`emailVerifications/${sanitizedEmail}`);

  try {
    // Save the OTP and its expiration time in the database
    await otpRef.set({
      otp,
      expiresAt,
    });
    logger.info(`[sendOTP] OTP generated for ${email}: ${otp} (expires at ${expiresAt})`);

    // Prepare email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code for Registration',
      text: `Your OTP code is: ${otp}. It will expire in 10 minutes.`,
    };

    // Send the OTP email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logger.error('[sendOTP] Error sending OTP email:', error);
        return res.status(500).send({ error: 'Failed to send OTP email.' });
      } else {
        logger.info(`[sendOTP] OTP email sent: ${info.response}`);
        return res.status(200).send({ message: 'OTP sent successfully.' });
      }
    });
  } catch (error) {
    logger.error('[sendOTP] Error:', error);
    return res.status(500).send({ error: 'Failed to send OTP.' });
  }
};

// -----------------------------------------------------------------------
// Controller: verifyOTP
// This endpoint accepts an email and an OTP, verifies the OTP (and its expiration),
// and, if valid, deletes the OTP record.
const verifyOTP = async (req, res) => {
  const { email, otp: userOTP } = req.body;
  if (!email || !userOTP) {
    logger.error('[verifyOTP] Missing email or OTP.');
    return res.status(400).send({ error: 'Email and OTP are required.' });
  }

  const sanitizedEmail = sanitizeEmail(email);
  const otpRef = db.ref(`emailVerifications/${sanitizedEmail}`);

  try {
    const snapshot = await otpRef.once('value');
    const data = snapshot.val();

    if (!data) {
      logger.error(`[verifyOTP] No OTP record found for ${email}.`);
      return res.status(400).send({ error: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > data.expiresAt) {
      logger.warn(`[verifyOTP] OTP for ${email} has expired.`);
      await otpRef.remove(); // Remove expired OTP
      return res.status(400).send({ error: 'OTP has expired. Please request a new one.' });
    }

    if (data.otp !== userOTP) {
      logger.warn(
        `[verifyOTP] Invalid OTP for ${email}. Entered: ${userOTP}, Expected: ${data.otp}`
      );
      return res.status(200).send({ success: false, message: 'Wrong OTP, Signup Unsuccessful!' });
    }

    // OTP is valid—remove it from the database to prevent reuse
    await otpRef.remove();
    logger.info(`[verifyOTP] OTP verified successfully for ${email}.`);
    return res.status(200).send({ message: 'OTP verified successfully.' });
  } catch (error) {
    logger.error('[verifyOTP] Error:', error);
    return res.status(500).send({ error: 'Failed to verify OTP.' });
  }
};

module.exports = { sendOTP, verifyOTP };
