// config/emailService.js
const nodemailer = require('nodemailer');
const logger = require('../middleware/logger'); 
// Create a transporter object with your Gmail credentials.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send an email
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    logger.info(`[EmailService] Sending email to: ${to}`);

    const mailOptions = {
      from: 'touristguide.team.official@gmail.com', // Must match the auth user
      to,
      subject,
      text,
      html,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    logger.info(`[EmailService] Email sent successfully: ${info.response}`);
    return { success: true, info };
  } catch (error) {
    logger.error('[EmailService] Error sending email:', error);
    return { success: false, error };
  }
};

module.exports = sendEmail;
