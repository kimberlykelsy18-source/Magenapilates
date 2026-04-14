const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requireAdmin = require('../middleware/auth');
const { buildInvoiceEmail } = require('../config/emailTemplates');

module.exports = ({ serviceSupabase, transporter }) => {
  const router = express.Router();

  // POST /api/admin/login
  router.post('/api/admin/login', async (_req, res) => {
    const { email, password } = _req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) return res.status(500).json({ error: 'Admin not configured' });

    if (email.toLowerCase() !== adminEmail.toLowerCase())
      return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, adminPassword).catch(() => false);
    const valid = match || password === adminPassword;

    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

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
      .select('*, payments(checkout_request_id, payment_reference, status)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Flatten the first payment record into each order for convenience
    const orders = (data || []).map((o) => {
      const payment = Array.isArray(o.payments) ? o.payments[0] : null;
      return {
        ...o,
        pesapal_tracking_id: payment?.checkout_request_id || null,
        payment_reference: payment?.payment_reference || null,
        payment_status: payment?.status || null,
        payments: undefined,
      };
    });

    res.json(orders);
  });

  // PATCH /api/admin/orders/:id — update order status
  router.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const { shipping_status } = req.body;

    const allowed = ['pending_payment', 'confirmed', 'failed'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const allowedShipping = ['pending', 'completed'];
    if (shipping_status && !allowedShipping.includes(shipping_status)) {
      return res.status(400).json({ error: 'Invalid shipping_status value' });
    }

    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (shipping_status) update.shipping_status = shipping_status;

    // Fetch current order BEFORE update so we know the previous status
    const { data: existing } = await serviceSupabase
      .from('pre_orders')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await serviceSupabase
      .from('pre_orders')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Order not found' });

    // Send confirmed invoice to customer when admin confirms a pending M-PESA order
    if (
      status === 'confirmed' &&
      existing?.status === 'pending_payment' &&
      existing?.payment_method === 'mpesa' &&
      existing?.customer_email &&
      transporter
    ) {
      function toShortId(n) {
        if (!n) return 'PRE-???';
        const letterIndex = Math.floor((n - 1) / 999);
        const numPart = ((n - 1) % 999) + 1;
        const letter = String.fromCharCode(65 + letterIndex);
        return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
      }
      const shortId   = toShortId(existing.order_number);
      const isRental  = existing.order_type === 'rental';
      const amountPaid = Number(existing.total_amount) + Number(existing.deposit_amount || 0);

      transporter.sendMail({
        from:    `"Magena Pilates" <${process.env.RESEND_FROM || "noreply@magenapilates.com"}>`,
        to:      existing.customer_email,
        subject: `Payment Confirmed — Invoice ${shortId} · Magena Pilates`,
        html:    buildInvoiceEmail({ order: existing, shortId, amountPaid, isRental, isPending: false }),
      }).catch((e) => console.error('[Admin] Confirmation email error:', e.message));
    }

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
