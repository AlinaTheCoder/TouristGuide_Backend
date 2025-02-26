// testEmail.js
const nodemailer = require('nodemailer');

// Create a transporter with the modified (space-free) app password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'alinalearns6@gmail.com',
    pass: 'gytxtslyamamsmxw', // Ensure this is the continuous string with no spaces
  },
});

// Optional: verify the transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error in transporter verification:', error);
  } else {
    console.log('Server is ready to take messages:', success);
  }
});

// Define mail options
const mailOptions = {
  from: 'alinalearns6@gmail.com',
  to: 'alinamukhtar660@gmail.com',
  subject: 'Test Email',
  text: 'Hello from Nodemailer!',
};

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error sending email:', error);
  } else {
    console.log('Email sent successfully:', info.response);
  }
});
