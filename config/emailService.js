const nodemailer = require('nodemailer');

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
    console.log(`[EmailService] Sending email to: ${to}`);

    const mailOptions = {
      from: 'alinalearns6@gmail.com', // Must match the auth user
      to,                          
      subject,                     
      text,                        
      html,                        
    };
    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log(`[EmailService] Email sent successfully: ${info.response}`);
    return { success: true, info };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    return { success: false, error };
  }
};
module.exports = sendEmail;
