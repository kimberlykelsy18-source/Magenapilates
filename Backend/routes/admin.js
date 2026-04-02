const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requireAdmin = require('../middleware/auth');

module.exports = ({ serviceSupabase }) => {
  const router = express.Router();

  // POST /api/admin/login
  router.post('/api/admin/login', async (_req, res) => {
    const { password } = _req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return res.status(500).json({ error: 'Admin not configured' });

    const match = await bcrypt.compare(password, adminPassword).catch(() => false);
    // Also allow plaintext comparison during initial setup (before hashing)
    const valid = match || password === adminPassword;

    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
  });

  // GET /api/admin/settings
  router.get('/api/admin/settings', requireAdmin, async (req, res) => {
    const { data, error } = await serviceSupabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // PUT /api/admin/settings
  router.put('/api/admin/settings', requireAdmin, async (req, res) => {
    const { terms, engraving_price, rental_fixed_months } = req.body;

    const { data, error } = await serviceSupabase
      .from('site_settings')
      .upsert({ id: 1, terms, engraving_price, rental_fixed_months, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // GET /api/admin/orders — all orders with optional status filter
  router.get('/api/admin/orders', requireAdmin, async (req, res) => {
    const { status } = req.query;

    let query = serviceSupabase
      .from('pre_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // PATCH /api/admin/orders/:id — update order status
  router.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const allowed = ['pending_payment', 'confirmed', 'completed', 'cancelled'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;

    const { data, error } = await serviceSupabase
      .from('pre_orders')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  });

  // DELETE /api/admin/orders/:id
  router.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    const { error } = await serviceSupabase.from('pre_orders').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  return router;
};
