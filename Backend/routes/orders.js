'use strict';
const express = require('express');
const paystack = require('../services/paystack');
const { buildInvoiceEmail, buildMpesaPendingEmail } = require('../config/emailTemplates');

function toShortOrderId(n) {
  if (!n) return 'PRE-???';
  const letterIndex = Math.floor((n - 1) / 999);
  const numPart = ((n - 1) % 999) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
}

function parseShortId(shortId) {
  const match = (shortId || '').toUpperCase().match(/^PRE-([A-Z])(\d{3})$/);
  if (!match) return null;
  const letterIndex = match[1].charCodeAt(0) - 65;
  const numPart = parseInt(match[2], 10);
  return letterIndex * 999 + numPart;
}

module.exports = ({ supabase, serviceSupabase, transporter }) => {
  const router = express.Router();

  // GET /api/orders/status?order_id=PRE-A001 — public order status check
  router.get('/api/orders/status', async (req, res) => {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });

    const orderNum = parseShortId(order_id.trim());
    if (!orderNum) return res.status(404).json({ error: 'Order not found' });

    const { data, error } = await serviceSupabase
      .from('pre_orders')
      .select('id, order_number, product_name, order_type, status, customer_name, created_at, total_amount, deposit_amount, payment_method')
      .eq('order_number', orderNum)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Order not found' });

    res.json({
      order_id: toShortOrderId(data.order_number),
      product_name: data.product_name,
      order_type: data.order_type,
      status: data.status,
      customer_name: data.customer_name,
      created_at: data.created_at,
      total_amount: data.total_amount,
      deposit_amount: data.deposit_amount,
      payment_method: data.payment_method,
    });
  });

  // GET /api/orders/:id — get order by UUID
  router.get('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await serviceSupabase
      .from('pre_orders')
      .select('id, order_number, product_name, order_type, quantity, total_amount, deposit_amount, payment_method, status, customer_name, customer_email, created_at')
      .eq('id', id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json({ ...data, short_id: toShortOrderId(data.order_number) });
  });

  // POST /api/orders — create order
  router.post('/api/orders', async (req, res) => {
    const {
      product_id, product_name, order_type, quantity,
      wants_engraving, engraving_text,
      leather_finish, wood_finish, height_range,
      context_of_use,
      business_name, business_email,
      business_type, business_registration_number, business_address,
      rental_agreement_signed, rental_agreement_name,
      customer_name, customer_email, customer_phone, customer_address,
      city_town, whatsapp_number, customer_country, currency,
      notes, total_amount, deposit_amount, payment_method,
    } = req.body;

    if (!product_id || !product_name || !order_type || !customer_name || !customer_email || !customer_phone || !total_amount || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (order_type === 'rental') {
      if (!business_name) return res.status(400).json({ error: 'Business name is required for rental orders' });
      if (!business_registration_number) return res.status(400).json({ error: 'Business registration number is required for rental orders' });
      if (!rental_agreement_signed) return res.status(400).json({ error: 'Rental agreement must be accepted' });
      if (!rental_agreement_name) return res.status(400).json({ error: 'Agreement signature name is required' });
    }

    const { data: order, error: orderError } = await serviceSupabase
      .from('pre_orders')
      .insert({
        product_id, product_name, order_type,
        quantity: quantity || 1,
        wants_engraving: wants_engraving || false,
        engraving_text: engraving_text ? String(engraving_text).slice(0, 30) : null,
        leather_finish, wood_finish, height_range,
        context_of_use,
        business_name, business_email,
        business_type, business_registration_number, business_address,
        rental_agreement_signed: rental_agreement_signed || false,
        rental_agreement_name,
        customer_name, customer_email, customer_phone, customer_address,
        city_town, whatsapp_number, customer_country, currency: currency || 'KES',
        notes: notes ? String(notes).slice(0, 200) : null,
        total_amount,
        deposit_amount: deposit_amount || 0,
        payment_method,
        status: payment_method === 'mpesa' ? 'payment_verification_pending' : 'pending_payment',
      })
      .select()
      .single();

    if (orderError) {
      console.error('[Orders] Insert error:', orderError.message);
      return res.status(500).json({ error: orderError.message });
    }

    const shortId = toShortOrderId(order.order_number);
    const amountDue = Number(total_amount) + Number(deposit_amount || 0);

    // ── CARD → Paystack ───────────────────────────────────────────────────────
    if (payment_method === 'card') {
      const reference = paystack.makeReference(shortId);
      try {
        let planCode = null;
        if (order_type === 'rental') {
          const plan = await paystack.createPlan({
            name: `${product_name} — Monthly Rental (${shortId})`,
            amount: Number(total_amount),
            interval: 'monthly',
            invoice_limit: 5,
          });
          planCode = plan.plan_code;
        }

        const tx = await paystack.initializeTransaction({
          email: customer_email,
          amount: amountDue,
          reference,
          plan: planCode || undefined,
          callback_url: `${process.env.FRONTEND_URL}/order-success`,
          metadata: { order_id: order.id, short_id: shortId, customer: customer_name },
        });

        await serviceSupabase.from('payments').insert({
          order_id: order.id,
          checkout_request_id: reference,
          amount: amountDue,
          payment_method: 'card',
          status: 'pending',
          flw_plan_id: planCode,
        });

        return res.status(201).json({
          order_id: order.id,
          short_id: shortId,
          redirect_url: tx.authorization_url,
          access_code: tx.access_code,
          reference,
          ...(planCode && { plan_code: planCode }),
        });
      } catch (err) {
        console.error('[Orders] Paystack error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── M-PESA — manual paybill, status = payment_verification_pending ────────
    if (payment_method === 'mpesa') {
      // Read paybill from site_settings (admin-configurable), fallback to env var
      const { data: siteCfg } = await serviceSupabase
        .from('site_settings').select('mpesa_paybill').eq('id', 1).single();
      const paybill = siteCfg?.mpesa_paybill || process.env.MPESA_PAYBILL || '';

      if (customer_email && transporter) {
        transporter.sendMail({
          from: `"Magena Pilates" <${process.env.RESEND_FROM || 'noreply@magenapilates.com'}>`,
          to: customer_email,
          subject: `Invoice ${shortId} — Magena Pilates`,
          html: buildInvoiceEmail({ order, shortId, amountPaid: amountDue, isRental: order_type === 'rental', isPending: true }),
        }).catch((e) => console.error('[Orders] M-PESA invoice email error:', e.message));

        transporter.sendMail({
          from: `"Magena Pilates" <${process.env.RESEND_FROM || 'noreply@magenapilates.com'}>`,
          to: customer_email,
          subject: `Payment Received — Verifying Order ${shortId} · Magena Pilates`,
          html: buildMpesaPendingEmail({ order, shortId }),
        }).catch((e) => console.error('[Orders] M-PESA pending email error:', e.message));
      }

      return res.status(201).json({
        order_id: order.id,
        short_id: shortId,
        payment_method: 'mpesa',
        mpesa_paybill: paybill,
        message: 'Order received. Please pay via M-PESA paybill using your order ID as the account number.',
      });
    }

    res.status(400).json({ error: 'Unsupported payment method' });
  });

  return router;
};
