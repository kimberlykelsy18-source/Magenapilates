const express = require('express');
const paystack = require('../services/paystack');
const { createServiceClient } = require('../config/supabase');

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
  // IMPORTANT: use express.raw() so we get the raw buffer for signature verification.
  router.post('/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    const rawBody   = req.body; // Buffer (because express.raw())

    if (!paystack.verifyWebhookSignature(rawBody, signature)) {
      console.warn('[Paystack Webhook] Invalid signature — ignoring');
      return res.status(401).send('Unauthorized');
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).send('Bad Request');
    }

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
        from:    `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
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
      from:    `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to:      order.customer_email,
      subject: `Order Confirmed — ${shortId} · Magena Pilates`,
      html:    buildConfirmationEmail({ order, shortId, amountPaid, reference: paystackRef, isRental }),
    }).catch((e) => console.error('[Paystack email] Customer:', e.message));
  }

  if (process.env.ADMIN_EMAIL) {
    transporter.sendMail({
      from:    `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
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
      from:    `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to:      process.env.ADMIN_EMAIL,
      subject: `Rental Subscription Cancelled — ${shortId}`,
      html:    `<div style="font-family:sans-serif;padding:24px"><h3>Subscription Cancelled</h3><p>Customer: ${order?.customer_name || customerEmail}</p><p>Product: ${order?.product_name}</p><p>Order: ${shortId}</p><p>Plan Code: ${planCode}</p></div>`,
    }).catch((e) => console.error('[Paystack email] Sub cancelled:', e.message));
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildConfirmationEmail({ order, shortId, amountPaid, reference, isRental }) {
  const subscriptionNote = isRental
    ? `<div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:13px;color:#1E40AF"><strong>Subscription active:</strong> Your monthly rental payments are set up automatically. No action needed each month.</div>`
    : '';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:#3D3530;padding:28px 32px;text-align:center"><h1 style="color:#EBE6DD;margin:0;font-size:22px;letter-spacing:2px">MAGENA PILATES</h1></div>
      <div style="background:#6B5C53;padding:24px 32px;text-align:center">
        <p style="color:rgba(235,230,221,0.8);font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px">Pre-Order Confirmed</p>
        <h2 style="color:#EBE6DD;margin:0;font-size:22px">${shortId}</h2>
      </div>
      <div style="padding:36px 32px">
        <p style="color:#555;margin:0 0 24px;font-size:15px">Hi <strong>${order.customer_name}</strong>, your pre-order is confirmed and payment received!</p>
        ${subscriptionNote}
        <table style="background:#F7F4F0;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;width:150px">Order ID</td><td style="padding:8px 12px;font-weight:bold;font-size:14px;color:#3D3530">${shortId}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Product</td><td style="padding:8px 12px;font-size:14px">${order.product_name}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Type</td><td style="padding:8px 12px;font-size:14px">${isRental ? 'Monthly Rental' : 'Purchase'}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Quantity</td><td style="padding:8px 12px;font-size:14px">${order.quantity}</td></tr>
          ${order.wants_engraving ? `<tr><td style="padding:8px 12px;color:#888;font-size:13px">Engraving</td><td style="padding:8px 12px;font-size:14px;color:#22c55e">FREE Logo Engraving included</td></tr>` : ''}
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Amount Paid</td><td style="padding:8px 12px;font-weight:bold;font-size:16px;color:#22c55e">KES ${Number(amountPaid).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Payment</td><td style="padding:8px 12px;font-size:14px">Card (Paystack)</td></tr>
          ${reference ? `<tr><td style="padding:8px 12px;color:#888;font-size:13px">Reference</td><td style="padding:8px 12px;font-size:14px">${reference}</td></tr>` : ''}
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Delivery To</td><td style="padding:8px 12px;font-size:14px">${order.customer_address || 'Not specified'}</td></tr>
        </table>
        <div style="background:#F0FDF4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:4px;margin:24px 0 0;font-size:13px;color:#166534">
          <strong>What's next?</strong> We'll contact you at ${order.customer_email} with delivery timelines. Keep this email as your receipt.
        </div>
      </div>
      <div style="background:#F7F4F0;padding:20px 32px;text-align:center;border-top:1px solid #eee">
        <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Magena Pilates · Nairobi, Kenya</p>
        <p style="color:#aaa;font-size:12px;margin:6px 0 0">Questions? Email us at ${process.env.ADMIN_EMAIL || 'info@magenapilates.com'}</p>
      </div>
    </div>`;
}

function buildAdminEmail({ order, shortId, amountPaid, isRental }) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:8px;border:1px solid #eee;padding:24px">
      <h2 style="color:#3D3530;margin:0 0 16px">New Pre-Order — ${shortId}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:130px">Customer</td><td style="padding:6px 0">${order.customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0">${order.customer_email}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Phone</td><td style="padding:6px 0">${order.customer_phone}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Product</td><td style="padding:6px 0">${order.product_name} (${order.order_type})</td></tr>
        <tr><td style="padding:6px 0;color:#888">Quantity</td><td style="padding:6px 0">${order.quantity}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Engraving</td><td style="padding:6px 0">${order.wants_engraving ? 'Yes' : 'No'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Amount</td><td style="padding:6px 0;font-weight:bold">KES ${Number(amountPaid).toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Type</td><td style="padding:6px 0">${isRental ? 'Monthly Rental' : 'Purchase'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Address</td><td style="padding:6px 0">${order.customer_address || '—'}</td></tr>
        ${order.notes ? `<tr><td style="padding:6px 0;color:#888">Notes</td><td style="padding:6px 0">${order.notes}</td></tr>` : ''}
      </table>
    </div>`;
}

function buildRecurringEmail({ customerEmail, customerName, shortId, amount, paystackRef, chargeOk }) {
  const color = chargeOk ? '#22c55e' : '#ef4444';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:8px;border:1px solid #eee;padding:24px">
      <h2 style="color:${color};margin:0 0 16px">Rental ${chargeOk ? 'Payment Received' : 'PAYMENT FAILED'} — ${shortId}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:130px">Customer</td><td style="padding:6px 0">${customerName || customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0">${customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Amount</td><td style="padding:6px 0;font-weight:bold;color:${color}">KES ${Number(amount).toLocaleString()}</td></tr>
        ${paystackRef ? `<tr><td style="padding:6px 0;color:#888">Paystack Ref</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${paystackRef}</td></tr>` : ''}
      </table>
    </div>`;
}
