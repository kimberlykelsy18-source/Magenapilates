'use strict';

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender — must be a domain verified in your Resend account.
// Fallback to onboarding@resend.dev for initial sandbox testing.
const DEFAULT_FROM = process.env.RESEND_FROM || 'Magena Pilates <onboarding@resend.dev>';

/**
 * Drop-in Nodemailer-compatible wrapper around Resend.
 * All existing transporter.sendMail({ from, to, subject, html }) calls work unchanged.
 * If RESEND_FROM is set it overrides whatever `from` the caller passes.
 */
const transporter = {
  async sendMail({ from, to, subject, html }) {
    const sender = process.env.RESEND_FROM || from || DEFAULT_FROM;
    const result = await resend.emails.send({ from: sender, to, subject, html });
    if (result.error) {
      console.error('[Email] Resend error:', result.error);
      throw new Error(result.error.message || 'Resend send failed');
    }
    console.log('[Email] Sent →', to, '| id:', result.data?.id);
    return result.data;
  },
};

console.log('[Email] Resend transporter ready — from:', DEFAULT_FROM);

module.exports = { transporter };
