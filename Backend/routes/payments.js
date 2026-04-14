const express = require('express');
const paystack = require('../services/paystack');
const { createServiceClient } = require('../config/supabase');
const { buildInvoiceEmail, buildAdminEmail, buildRecurringEmail } = require('../config/emailTemplates');

function toShortOrderId(n) {
  if (!n) return 'PRE-???';
  const letterIndex = Math.floor((n - 1) / 999);
  const numPart = ((n - 1) % 999) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
}

module.exports = ({ transporter }) => {
  const router = express.Router();
  const db = createServiceClient();

  // ── Paystack Webhook ──────────────────────────────────────────────────────
  // Register in Paystack Dashboard > Settings > API Keys > Test Webhook URL
  // Webhook URL: {BACKEND_URL}/paystack/webhook
  //
  // Paystack signs the raw request body with HMAC-SHA512 using your secret key.
  // Signature is in the 'x-paystack-signature' header.
  //
  // Events handled:
  //   charge.success          → purchase confirmed OR first rental payment confirmed
  //   subscription.disable    → rental subscription cancelled
  //   subscription.not_renew  → subscription set to not renew (treated as cancelled)
  //
  // IMPORTANT: signature verification uses req.rawBody (the raw Buffer saved by express.json verify callback).
  router.post('/paystack/webhook', async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    const rawBody   = req.rawBody; // Buffer saved by express.json verify in index.js

    if (!rawBody || !paystack.verifyWebhookSignature(rawBody, signature)) {
      console.warn('[Paystack Webhook] Invalid signature — ignoring');
      return res.status(401).send('Unauthorized');
    }

    const event = req.body; // already parsed by express.json

    const eventType = event?.event;
    console.log('[Paystack Webhook]', eventType, '| ref:', event?.data?.reference);

    // Acknowledge immediately — Paystack expects 200 fast
    res.status(200).send('OK');

    try {
      if (eventType === 'charge.success') {
        await handleChargeSuccess(event.data, db, transporter);
      } else if (eventType === 'subscription.disable' || eventType === 'subscription.not_renew') {
        await handleSubscriptionCancelled(event.data, db, transporter);
      } else {
        console.log('[Paystack Webhook] Unhandled event:', eventType);
      }
    } catch (err) {
      console.error('[Paystack Webhook] Handler error:', err.message);
    }
  });

  // ── GET /api/paystack/status ──────────────────────────────────────────────
  // Poll endpoint called by frontend after payment to confirm order status.
  // ?reference=xxx  (the Paystack transaction reference)
  router.get('/api/paystack/status', async (req, res) => {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ error: 'reference required' });

    try {
      const { data: payment } = await db
        .from('payments')
        .select('id, order_id, status, payment_reference')
        .eq('checkout_request_id', reference)
        .maybeSingle();

      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      // Already confirmed by webhook
      if (payment.status === 'paid') {
        const { data: order } = await db
          .from('pre_orders')
          .select('id, order_number, product_name, order_type, quantity, total_amount, deposit_amount, customer_name, customer_email, status')
          .eq('id', payment.order_id)
          .single();
        return res.json({
          status:            'completed',
          order_id:          payment.order_id,
          payment_reference: payment.payment_reference,
          order:             order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
        });
      }

      // Verify directly with Paystack API
      try {
        const tx = await paystack.verifyTransaction(reference);
        if (tx.status === 'success') {
          const result = await processConfirmedPayment({ tx, reference, db, transporter });
          return res.json(result);
        }
        if (tx.status === 'failed' || tx.status === 'abandoned') {
          return res.json({ status: 'failed' });
        }
      } catch (verifyErr) {
        console.error('[Paystack status] verify error:', verifyErr.message);
      }

      return res.json({ status: 'pending' });
    } catch (err) {
      console.error('[Paystack status]', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ── charge.success webhook handler ───────────────────────────────────────────
async function handleChargeSuccess(data, db, transporter) {
  const reference = data.reference;
  console.log('[Paystack] charge.success | ref:', reference);

  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status, amount')
    .eq('checkout_request_id', reference)
    .maybeSingle();

  if (!payment) {
    // Could be a recurring subscription charge — match by customer email
    const customerEmail = data.customer?.email;
    if (!customerEmail) {
      console.warn('[Paystack] charge.success — no matching payment and no email, ref:', reference);
      return;
    }

    const { data: rentalOrder } = await db
      .from('pre_orders')
      .select('id, order_number, customer_name, product_name')
      .eq('customer_email', customerEmail)
      .eq('order_type', 'rental')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const amountKES = (data.amount || 0) / 100;
    const shortId   = rentalOrder ? toShortOrderId(rentalOrder.order_number) : 'unknown';
    console.log(`[Paystack] Recurring charge SUCCESS for ${customerEmail} | KES ${amountKES}`);

    if (process.env.ADMIN_EMAIL) {
      transporter.sendMail({
        from:    `"Magena Pilates" <${process.env.RESEND_FROM || "noreply@magenapilates.com"}>`,
        to:      process.env.ADMIN_EMAIL,
        subject: `Rental Payment Received — ${shortId}`,
        html:    buildRecurringEmail({ customerEmail, customerName: rentalOrder?.customer_name, shortId, amount: amountKES, paystackRef: data.reference, chargeOk: true }),
      }).catch((e) => console.error('[Paystack email] Recurring:', e.message));
    }
    return;
  }

  if (payment.status === 'paid') return; // already processed

  await processConfirmedPayment({ tx: { ...data, status: 'success', amount: data.amount / 100 }, reference, db, transporter, payment });
}

// ── Shared payment confirmation logic ─────────────────────────────────────────
async function processConfirmedPayment({ tx, reference, db, transporter, payment: existingPayment }) {
  const { data: payment } = existingPayment
    ? { data: existingPayment }
    : await db.from('payments').select('id, order_id, status, amount').eq('checkout_request_id', reference).maybeSingle();

  if (!payment) {
    console.warn('[Paystack] No payment found for ref:', reference);
    return { status: 'not_found' };
  }

  if (payment.status === 'paid') {
    const { data: order } = await db.from('pre_orders').select('id, order_number, product_name, order_type, total_amount, deposit_amount, customer_name, customer_email, status').eq('id', payment.order_id).single();
    return {
      status:            'completed',
      order_id:          payment.order_id,
      payment_reference: payment.payment_reference,
      order:             order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
    };
  }

  const paystackRef = tx.reference || reference;
  const amountPaid  = tx.amount != null ? tx.amount : payment.amount;

  await db.from('payments').update({ status: 'paid', payment_reference: paystackRef }).eq('id', payment.id);
  const { data: order } = await db.from('pre_orders').select('*').eq('id', payment.order_id).single();
  await db.from('pre_orders').update({ status: 'confirmed' }).eq('id', payment.order_id);

  const shortId  = toShortOrderId(order?.order_number);
  const isRental = order?.order_type === 'rental';

  if (order?.customer_email) {
    transporter.sendMail({
      from:    `"Magena Pilates" <${process.env.RESEND_FROM || "noreply@magenapilates.com"}>`,
      to:      order.customer_email,
      subject: `Order Confirmed — ${shortId} · Magena Pilates`,
      html:    buildInvoiceEmail({ order, shortId, amountPaid, reference: paystackRef, isRental }),
    }).catch((e) => console.error('[Paystack email] Customer:', e.message));
  }

  if (process.env.ADMIN_EMAIL) {
    transporter.sendMail({
      from:    `"Magena Pilates" <${process.env.RESEND_FROM || "noreply@magenapilates.com"}>`,
      to:      process.env.ADMIN_EMAIL,
      subject: `New Confirmed Pre-Order — ${shortId}`,
      html:    buildAdminEmail({ order, shortId, amountPaid, isRental }),
    }).catch((e) => console.error('[Paystack email] Admin:', e.message));
  }

  return {
    status:            'completed',
    order_id:          payment.order_id,
    payment_reference: paystackRef,
    order:             { ...order, short_id: shortId, status: 'confirmed' },
  };
}

// ── Subscription cancelled webhook ────────────────────────────────────────────
async function handleSubscriptionCancelled(data, db, transporter) {
  const planCode      = data?.plan?.plan_code;
  const customerEmail = data?.customer?.email;
  console.log('[Paystack] subscription cancelled | plan:', planCode, '| email:', customerEmail);

  if (!planCode) return;

  const { data: payment } = await db.from('payments').select('id, order_id').eq('flw_plan_id', planCode).maybeSingle();
  if (!payment) return;

  await db.from('payments').update({ failure_reason: 'Subscription cancelled' }).eq('id', payment.id);
  const { data: order } = await db.from('pre_orders').select('order_number, customer_name, product_name').eq('id', payment.order_id).single();
  const shortId = toShortOrderId(order?.order_number);

  if (process.env.ADMIN_EMAIL) {
    transporter.sendMail({
      from:    `"Magena Pilates" <${process.env.RESEND_FROM || "noreply@magenapilates.com"}>`,
      to:      process.env.ADMIN_EMAIL,
      subject: `Rental Subscription Cancelled — ${shortId}`,
      html:    `<div style="font-family:sans-serif;padding:24px"><h3>Subscription Cancelled</h3><p>Customer: ${order?.customer_name || customerEmail}</p><p>Product: ${order?.product_name}</p><p>Order: ${shortId}</p><p>Plan Code: ${planCode}</p></div>`,
    }).catch((e) => console.error('[Paystack email] Sub cancelled:', e.message));
  }
}

// ── Email templates are in config/emailTemplates.js ──────────────────────────
// buildInvoiceEmail, buildAdminEmail, buildRecurringEmail imported at top
