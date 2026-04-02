const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD,
  },
});

// Verify connection at startup so misconfiguration is caught early
transporter.verify((err) => {
  if (err) {
    console.error('[Email] SMTP connection failed:', err.message);
  } else {
    console.log('[Email] SMTP ready — sending from', process.env.GMAIL_EMAIL);
  }
});

module.exports = { transporter };
