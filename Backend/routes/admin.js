'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requireAdmin = require('../middleware/auth');
const { buildInvoiceEmail, buildStatusChangeEmail } = require('../config/emailTemplates');

function toShortId(n) {
  if (!n) return 'PRE-???';
  const letterIndex = Math.floor((n - 1) / 999);
  const numPart = ((n - 1) % 999) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
}

module.exports = ({ serviceSupabase, transporter }) => {
  const router = express.Router();

  // ── Auth ──────────────────────────────────────────────────────────────────

  router.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const adminEmail = process.env.ADMIN_EMAIL;
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

  router.patch('/api/admin/password', requireAdmin, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const adminPassword = process.env.ADMIN_PASSWORD;
    const match = await bcrypt.compare(current_password, adminPassword).catch(() => false);
    const valid = match || current_password === adminPassword;
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 10);
    process.env.ADMIN_PASSWORD = hashed;
    res.json({ success: true, message: 'Password updated. Set ADMIN_PASSWORD in your environment variables to persist.' });
  });

  // ── Settings ──────────────────────────────────────────────────────────────

  router.get('/api/admin/settings', requireAdmin, async (_req, res) => {
    const { data, error } = await serviceSupabase
      .from('site_settings').select('*').eq('id', 1).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  router.put('/api/admin/settings', requireAdmin, async (req, res) => {
    const ALLOWED = ['terms', 'engraving_price', 'rental_fixed_months', 'rental_deposit_formula',
      'instagram_url', 'pinterest_url', 'whatsapp_number', 'footer_disclaimer',
      'post_order_message', 'waitlist_message', 'exchange_rate'];
    const updates = { id: 1, updated_at: new Date().toISOString() };
    for (const field of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }

    const { data, error } = await serviceSupabase
      .from('site_settings')
      .upsert(updates)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  router.get('/api/admin/settings/finishes', requireAdmin, async (_req, res) => {
    const { data, error } = await serviceSupabase
      .from('site_settings')
      .select('leather_finishes, wood_finishes, leather_finish_images, wood_finish_images')
      .eq('id', 1).single();
    if (error) return res.status(500).json({ error: error.message });

    const leatherNames = data?.leather_finishes || ['Black', 'Tan', 'Cream', 'Olive', 'Custom'];
    const woodNames    = data?.wood_finishes    || ['Natural Oil', 'Dark Walnut Stain', 'Ebony', 'Custom'];
    const leatherImgs  = data?.leather_finish_images || {};
    const woodImgs     = data?.wood_finish_images    || {};

    res.json({
      leather_finishes: leatherNames.map((name) => ({ name, imageUrl: leatherImgs[name] || null })),
      wood_finishes:    woodNames.map((name)    => ({ name, imageUrl: woodImgs[name]    || null })),
    });
  });

  router.put('/api/admin/settings/finishes', requireAdmin, async (req, res) => {
    const { leather_finishes = [], wood_finishes = [] } = req.body;
    // Accept [{name, imageUrl?}] arrays
    const leatherNames = leather_finishes.map((f) => (typeof f === 'string' ? f : f.name));
    const woodNames    = wood_finishes.map((f)    => (typeof f === 'string' ? f : f.name));

    const leatherImgs = {};
    for (const f of leather_finishes) {
      if (f.imageUrl && f.name) leatherImgs[f.name] = f.imageUrl;
    }
    const woodImgs = {};
    for (const f of wood_finishes) {
      if (f.imageUrl && f.name) woodImgs[f.name] = f.imageUrl;
    }

    const { data, error } = await serviceSupabase
      .from('site_settings')
      .upsert({
        id: 1,
        leather_finishes: leatherNames,
        wood_finishes:    woodNames,
        leather_finish_images: leatherImgs,
        wood_finish_images:    woodImgs,
        updated_at: new Date().toISOString(),
      })
      .select('leather_finishes, wood_finishes, leather_finish_images, wood_finish_images')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    res.json({
      leather_finishes: (data.leather_finishes || []).map((name) => ({ name, imageUrl: (data.leather_finish_images || {})[name] || null })),
      wood_finishes:    (data.wood_finishes    || []).map((name) => ({ name, imageUrl: (data.wood_finish_images    || {})[name] || null })),
    });
  });

  // ── Orders ────────────────────────────────────────────────────────────────

  router.get('/api/admin/orders', requireAdmin, async (req, res) => {
    const { status, order_type, country, context_of_use } = req.query;

    let query = serviceSupabase
      .from('pre_orders')
      .select('*, payments(checkout_request_id, payment_reference, status)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (order_type && order_type !== 'all') query = query.eq('order_type', order_type);
    if (country && country !== 'all') query = query.eq('customer_country', country);
    if (context_of_use && context_of_use !== 'all') query = query.eq('context_of_use', context_of_use);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const orders = (data || []).map((o) => {
      const payment = Array.isArray(o.payments) ? o.payments[0] : null;
      return {
        ...o,
        transaction_id: payment?.checkout_request_id || null,
        payment_reference: o.payment_reference || payment?.payment_reference || null,
        payment_status: payment?.status || null,
        payments: undefined,
      };
    });
    res.json(orders);
  });

  // GET /api/admin/orders/export — CSV
  router.get('/api/admin/orders/export', requireAdmin, async (req, res) => {
    const { status, order_type } = req.query;

    let query = serviceSupabase.from('pre_orders').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    if (order_type && order_type !== 'all') query = query.eq('order_type', order_type);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];
    const header = [
      'Order ID', 'Date', 'Customer Name', 'Email', 'Phone', 'WhatsApp',
      'Country', 'City/Town', 'Delivery Address',
      'Product', 'Type', 'Leather Finish', 'Wood Finish', 'Engraving Text',
      'Height Range', 'Context',
      'Business Name', 'Business Type', 'Registration No.', 'Business Address', 'Business Email',
      'Amount (KES)', 'Deposit (KES)', 'Payment Method', 'Status',
    ].join(',');

    const csv = [
      header,
      ...rows.map((r) => [
        `"${toShortId(r.order_number)}"`,
        `"${new Date(r.created_at).toLocaleDateString()}"`,
        `"${(r.customer_name || '').replace(/"/g, '""')}"`,
        `"${(r.customer_email || '').replace(/"/g, '""')}"`,
        `"${(r.customer_phone || '').replace(/"/g, '""')}"`,
        `"${(r.whatsapp_number || '').replace(/"/g, '""')}"`,
        `"${(r.customer_country || '').replace(/"/g, '""')}"`,
        `"${(r.city_town || '').replace(/"/g, '""')}"`,
        `"${(r.customer_address || '').replace(/"/g, '""')}"`,
        `"${(r.product_name || '').replace(/"/g, '""')}"`,
        `"${r.order_type || ''}"`,
        `"${r.leather_finish || ''}"`,
        `"${r.wood_finish || ''}"`,
        `"${(r.engraving_text || '').replace(/"/g, '""')}"`,
        `"${r.height_range || ''}"`,
        `"${r.context_of_use || ''}"`,
        `"${(r.business_name || '').replace(/"/g, '""')}"`,
        `"${(r.business_type || '').replace(/"/g, '""')}"`,
        `"${(r.business_registration_number || '').replace(/"/g, '""')}"`,
        `"${(r.business_address || '').replace(/"/g, '""')}"`,
        `"${(r.business_email || '').replace(/"/g, '""')}"`,
        r.total_amount,
        r.deposit_amount || 0,
        `"${r.payment_method || ''}"`,
        `"${r.status || ''}"`,
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  });

  // PATCH /api/admin/orders/:id/confirm-payment — quick confirm button
  router.patch('/api/admin/orders/:id/confirm-payment', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { data: existing } = await serviceSupabase.from('pre_orders').select('*').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const { data, error } = await serviceSupabase
      .from('pre_orders').update({ status: 'confirmed' }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    if (existing.customer_email && transporter) {
      const shortId = toShortId(existing.order_number);
      const amountPaid = Number(existing.total_amount) + Number(existing.deposit_amount || 0);
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.RESEND_FROM || 'noreply@magenapilates.com'}>`,
        to: existing.customer_email,
        subject: `Payment Confirmed — Invoice ${shortId} · Magena Pilates`,
        html: buildInvoiceEmail({ order: existing, shortId, amountPaid, isRental: existing.order_type === 'rental', isPending: false }),
      }).catch((e) => console.error('[Admin] Confirm payment email error:', e.message));
    }
    res.json(data);
  });

  // PATCH /api/admin/orders/:id — general status/notes update
  router.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, notes, shipping_status } = req.body;

    const allowed = ['pending_payment', 'payment_verification_pending', 'confirmed', 'completed', 'cancelled', 'failed'];
    if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status value' });

    const allowedShipping = ['pending', 'completed'];
    if (shipping_status && !allowedShipping.includes(shipping_status)) return res.status(400).json({ error: 'Invalid shipping_status value' });

    const { data: existing } = await serviceSupabase.from('pre_orders').select('*').eq('id', id).single();

    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (shipping_status) update.shipping_status = shipping_status;

    const { data, error } = await serviceSupabase
      .from('pre_orders').update(update).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Order not found' });

    // Email triggers
    if (status && existing?.customer_email && transporter && status !== existing.status) {
      const shortId = toShortId(existing.order_number);
      const amountPaid = Number(existing.total_amount) + Number(existing.deposit_amount || 0);
      let subject = null, html = null;

      if (status === 'confirmed') {
        subject = `Payment Confirmed — Invoice ${shortId} · Magena Pilates`;
        html = buildInvoiceEmail({ order: existing, shortId, amountPaid, isRental: existing.order_type === 'rental', isPending: false });
      } else if (status === 'failed') {
        subject = `Payment Update — Order ${shortId} · Magena Pilates`;
        html = buildStatusChangeEmail({ order: existing, shortId, status: 'failed' });
      } else if (status === 'completed') {
        subject = `Your Equipment is On Its Way — ${shortId} · Magena Pilates`;
        html = buildStatusChangeEmail({ order: existing, shortId, status: 'completed' });
      }

      if (subject && html) {
        transporter.sendMail({
          from: `"Magena Pilates" <${process.env.RESEND_FROM || 'noreply@magenapilates.com'}>`,
          to: existing.customer_email,
          subject,
          html,
        }).catch((e) => console.error('[Admin] Status email error:', e.message));
      }
    }

    res.json(data);
  });

  router.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await serviceSupabase.from('pre_orders').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ── Customers ─────────────────────────────────────────────────────────────

  router.get('/api/admin/customers', requireAdmin, async (req, res) => {
    const { search, type } = req.query;

    let query = serviceSupabase
      .from('pre_orders')
      .select('customer_name, customer_email, customer_phone, customer_country, total_amount, deposit_amount, created_at, order_type')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const map = new Map();
    for (const o of (data || [])) {
      const key = o.customer_email?.toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          customer_name: o.customer_name,
          customer_email: o.customer_email,
          customer_phone: o.customer_phone,
          location: o.customer_country,
          total_spend: 0,
          orders_count: 0,
          last_order: o.created_at,
          has_purchase: false,
          has_rental: false,
        });
      }
      const c = map.get(key);
      c.total_spend += Number(o.total_amount) + Number(o.deposit_amount || 0);
      c.orders_count += 1;
      if (o.created_at > c.last_order) c.last_order = o.created_at;
      if (o.order_type === 'purchase') c.has_purchase = true;
      if (o.order_type === 'rental') c.has_rental = true;
    }

    let customers = [...map.values()].map((c) => ({
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      customer_phone: c.customer_phone,
      location: c.location,
      total_spend: c.total_spend,
      orders_count: c.orders_count,
      last_order: c.last_order,
      type: c.has_purchase && c.has_rental ? 'Both' : c.has_purchase ? 'Buyer' : 'Renter',
    }));

    if (type && type !== 'all') {
      customers = customers.filter((c) => c.type === type);
    }

    res.json(customers);
  });

  router.get('/api/admin/customers/export', requireAdmin, async (req, res) => {
    const { data, error } = await serviceSupabase
      .from('pre_orders')
      .select('customer_name, customer_email, customer_phone, customer_country, total_amount, deposit_amount, created_at, order_type')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const map = new Map();
    for (const o of (data || [])) {
      const key = o.customer_email?.toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          customer_name: o.customer_name,
          customer_email: o.customer_email,
          customer_phone: o.customer_phone,
          location: o.customer_country,
          total_spend: 0,
          orders_count: 0,
          last_order: o.created_at,
          has_purchase: false,
          has_rental: false,
        });
      }
      const c = map.get(key);
      c.total_spend += Number(o.total_amount) + Number(o.deposit_amount || 0);
      c.orders_count += 1;
      if (o.created_at > c.last_order) c.last_order = o.created_at;
      if (o.order_type === 'purchase') c.has_purchase = true;
      if (o.order_type === 'rental') c.has_rental = true;
    }

    const customers = [...map.values()].map((c) => ({
      ...c,
      type: c.has_purchase && c.has_rental ? 'Both' : c.has_purchase ? 'Buyer' : 'Renter',
    }));

    const header = ['Name', 'Email', 'Phone', 'Country', 'Orders', 'Total Spend (KES)', 'Type', 'Last Order'].join(',');
    const csv = [
      header,
      ...customers.map((c) => [
        `"${(c.customer_name || '').replace(/"/g, '""')}"`,
        `"${(c.customer_email || '').replace(/"/g, '""')}"`,
        `"${(c.customer_phone || '').replace(/"/g, '""')}"`,
        `"${(c.location || '').replace(/"/g, '""')}"`,
        c.orders_count,
        c.total_spend.toFixed(2),
        `"${c.type}"`,
        `"${new Date(c.last_order).toLocaleDateString()}"`,
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  });

  // ── Analytics ─────────────────────────────────────────────────────────────

  router.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    const { period = 'all' } = req.query;

    let dateFilter = null;
    const now = new Date();
    if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); dateFilter = d.toISOString(); }
    else if (period === 'month') { const d = new Date(now); d.setMonth(d.getMonth() - 1); dateFilter = d.toISOString(); }
    else if (period === '3months') { const d = new Date(now); d.setMonth(d.getMonth() - 3); dateFilter = d.toISOString(); }

    let query = serviceSupabase
      .from('pre_orders')
      .select('id, order_type, total_amount, deposit_amount, product_name, customer_country, customer_email, status')
      .neq('status', 'cancelled');

    if (dateFilter) query = query.gte('created_at', dateFilter);
    const { data: orders, error: ordersErr } = await query;
    if (ordersErr) return res.status(500).json({ error: ordersErr.message });

    const { count: waitlistCount } = await serviceSupabase
      .from('waitlist').select('id', { count: 'exact', head: true });

    const all = orders || [];
    const totalRevenue = all.reduce((s, o) => s + Number(o.total_amount) + Number(o.deposit_amount || 0), 0);
    const uniqueEmails = new Set(all.map((o) => o.customer_email?.toLowerCase()).filter(Boolean)).size;

    const countryMap = {}, productMap = {};
    let buyCount = 0, rentCount = 0;

    for (const o of all) {
      if (o.customer_country) countryMap[o.customer_country] = (countryMap[o.customer_country] || 0) + 1;
      if (o.product_name) {
        if (!productMap[o.product_name]) productMap[o.product_name] = { revenue: 0, count: 0 };
        productMap[o.product_name].revenue += Number(o.total_amount);
        productMap[o.product_name].count += 1;
      }
      if (o.order_type === 'purchase') buyCount++; else rentCount++;
    }

    const topProduct = Object.entries(productMap).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || '—';

    res.json({
      total_orders: all.length,
      total_revenue: totalRevenue,
      total_customers: uniqueEmails,
      average_order_value: all.length > 0 ? Math.round(totalRevenue / all.length) : 0,
      total_waitlist: waitlistCount || 0,
      top_product: topProduct,
      orders_by_country: Object.entries(countryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      revenue_by_product: Object.entries(productMap).map(([name, v]) => ({ name, revenue: v.revenue, count: v.count })),
      buy_vs_rent: [{ name: 'Purchase', value: buyCount }, { name: 'Rental', value: rentCount }],
    });
  });

  return router;
};
