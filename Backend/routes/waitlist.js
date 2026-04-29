'use strict';
const express = require('express');
const requireAdmin = require('../middleware/auth');

module.exports = ({ serviceSupabase, transporter }) => {
  const router = express.Router();

  // POST /api/waitlist — public signup
  router.post('/api/waitlist', async (req, res) => {
    const {
      name, email, phone, country, city_town,
      equipment_interest, context_of_use,
      units_needed, buy_or_rent,
      business_name, business_email,
      notes,
    } = req.body;

    if (!name || !email || !equipment_interest) {
      return res.status(400).json({ error: 'Name, email and equipment interest are required' });
    }

    const { data, error } = await serviceSupabase
      .from('waitlist')
      .insert({
        name, email, phone, country, city_town,
        equipment_interest, context_of_use,
        units_needed, buy_or_rent,
        business_name, business_email,
        notes,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (transporter) {
      const { buildWaitlistEmail } = require('../config/emailTemplates');
      const { data: settings } = await serviceSupabase
        .from('site_settings').select('waitlist_message').eq('id', 1).single();
      const message = settings?.waitlist_message ||
        "Thank you for joining our waitlist! We'll notify you as soon as the equipment becomes available.";
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.RESEND_FROM || 'noreply@magenapilates.com'}>`,
        to: email,
        subject: "You're on the waitlist — Magena Pilates",
        html: buildWaitlistEmail({ name, equipment_interest, message }),
      }).catch((e) => console.error('[Waitlist] Email error:', e.message));
    }

    res.status(201).json(data);
  });

  // GET /api/admin/waitlist
  router.get('/api/admin/waitlist', requireAdmin, async (req, res) => {
    const { data, error } = await serviceSupabase
      .from('waitlist').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // DELETE /api/admin/waitlist/:id
  router.delete('/api/admin/waitlist/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await serviceSupabase.from('waitlist').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // GET /api/admin/waitlist/export — CSV
  router.get('/api/admin/waitlist/export', requireAdmin, async (req, res) => {
    const { data, error } = await serviceSupabase
      .from('waitlist').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];
    const header = [
      'Name', 'Email', 'Phone', 'Country', 'City/Town',
      'Equipment', 'Context', 'Units Needed', 'Buy/Rent',
      'Notes', 'Date',
    ].join(',');

    const csv = [
      header,
      ...rows.map((r) => [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.phone || '').replace(/"/g, '""')}"`,
        `"${(r.country || '').replace(/"/g, '""')}"`,
        `"${(r.city_town || '').replace(/"/g, '""')}"`,
        `"${(r.equipment_interest || '').replace(/"/g, '""')}"`,
        `"${(r.context_of_use || '').replace(/"/g, '""')}"`,
        `"${(r.units_needed || '').replace(/"/g, '""')}"`,
        `"${(r.buy_or_rent || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
        `"${new Date(r.created_at).toLocaleDateString()}"`,
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="waitlist.csv"');
    res.send(csv);
  });

  return router;
};
