const express = require('express');
const flw = require('../services/flutterwave');
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

  // ── Flutterwave Webhook ────────────────────────────────────────────────────
  // Register in Flutterwave Dashboard > Settings > Webhooks.
  // Set "Secret Hash" in the dashboard to match FLW_WEBHOOK_HASH in .env.
  // Webhook URL: {BACKEND_URL}/flutterwave/webhook
  router.post('/flutterwave/webhook', express.json(), async (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_HASH?.trim();
    const signature  = req.headers['verif-hash'];

    if (!secretHash || signature !== secretHash) {
      console.warn('[FLW Webhook] Invalid signature — ignoring');
      return res.status(401).send('Unauthorized');
    }

    const event = req.body;
    console.log('[FLW Webhook] Event:', event?.event, '| ref:', event?.data?.reference || event?.data?.tx_ref);

    // Acknowledge immediately so Flutterwave does not retry
    res.status(200).send('OK');

    try {
      if (event?.event === 'charge.completed') {
        await handleChargeEvent(event.data, db, transporter);
      } else {
        console.log('[FLW Webhook] Unhandled event type:', event?.event);
      }
    } catch (err) {
      console.error('[FLW Webhook] Handler error:', err.message);
    }
  });

  // ── Frontend status check — called after charge succeeds (no redirect in v4) ──
  // Used when next_action is null (immediate success) or after 3DS redirect
  // Frontend calls: GET /api/flutterwave/status?tx_ref=PRE-A001&charge_id=xxx
  router.get('/api/flutterwave/status', async (req, res) => {
    const { tx_ref, charge_id } = req.query;

    if (!tx_ref && !charge_id) {
      return res.status(400).json({ error: 'tx_ref or charge_id required' });
    }

    try {
      // Look up our payment record by tx_ref (= shortId stored in checkout_request_id)
      const { data: payment } = await db
        .from('payments')
        .select('id, order_id, status, payment_reference, flw_plan_id')
        .eq('checkout_request_id', tx_ref)
        .maybeSingle();

      if (!payment) return res.status(404).json({ error: 'Payment record not found' });

      // Already confirmed (webhook already processed it)
      if (payment.status === 'paid') {
        const { data: order } = await db
          .from('pre_orders')
          .select('id, order_number, product_name, order_type, quantity, total_amount, deposit_amount, customer_name, customer_email, status')
          .eq('id', payment.order_id)
          .single();
        return res.json({
          status: 'completed',
          order_id: payment.order_id,
          payment_reference: payment.payment_reference,
          order: order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
        });
      }

      // Verify directly with Flutterwave using the stored charge ID
      const flwChargeId = charge_id || payment.flw_plan_id;
      if (!flwChargeId) return res.json({ status: 'pending' });

      const result = await handleChargeEvent({ id: flwChargeId, reference: tx_ref }, db, transporter);
      return res.json(result);
    } catch (err) {
      console.error('[FLW status]', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ── Shared handler ────────────────────────────────────────────────────────────

async function handleChargeEvent(chargeData, db, transporter) {
  const chargeId = chargeData.id;
  const txRef    = chargeData.reference || chargeData.tx_ref;

  if (!chargeId) return { status: 'invalid' };

  // Verify with Flutterwave
  let charge;
  try {
    charge = await flw.getCharge(chargeId);
  } catch (err) {
    console.error('[FLW] getCharge failed:', err.message);
    return { status: 'pending' };
  }

  // Look up our payment by tx_ref (= shortId)
  const lookupRef = txRef || charge.reference;
  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status, amount')
    .eq('checkout_request_id', lookupRef)
    .maybeSingle();

  if (!payment) {
    console.warn('[FLW] No payment for ref:', lookupRef);
    return { status: 'not_found' };
  }

  if (payment.status === 'paid') {
    const { data: order } = await db
      .from('pre_orders')
      .select('id, order_number, product_name, order_type, total_amount, deposit_amount, customer_name, customer_email, status')
      .eq('id', payment.order_id)
      .single();
    return {
      status: 'completed',
      order_id: payment.order_id,
      order: order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
    };
  }

  const chargeStatus = charge.status;
  const isSuccess = chargeStatus === 'succeeded' || chargeStatus === 'successful';
  const isFailed  = chargeStatus === 'failed';

  if (isFailed) {
    await db.from('payments').update({ status: 'failed', failure_reason: charge.processor_response || 'Payment failed' }).eq('id', payment.id);
    await db.from('pre_orders').update({ status: 'cancelled' }).eq('id', payment.order_id);
    return { status: 'failed' };
  }

  if (!isSuccess) {
    return { status: 'pending' };
  }

  // ── Payment successful ─────────────────────────────────────────────────────
  const flwRef = charge.flw_ref || charge.id?.toString() || null;

  await db.from('payments').update({ status: 'paid', payment_reference: flwRef }).eq('id', payment.id);

  const { data: order } = await db.from('pre_orders').select('*').eq('id', payment.order_id).single();
  await db.from('pre_orders').update({ status: 'confirmed' }).eq('id', payment.order_id);

  const shortId   = toShortOrderId(order?.order_number);
  const amountPaid = charge.amount || payment.amount;
  const isRental   = order?.order_type === 'rental';

  if (order?.customer_email) {
    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: order.customer_email,
      subject: `Order Confirmed — ${shortId} · Magena Pilates`,
      html: buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod: charge.payment_type || 'Card', reference: flwRef, isRental }),
    }).catch((err) => console.error('[FLW email] Customer:', err.message));
  }

  if (process.env.ADMIN_EMAIL) {
    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Confirmed Pre-Order — ${shortId}`,
      html: buildAdminNotificationEmail({ order, shortId, amountPaid, isRental }),
    }).catch((err) => console.error('[FLW email] Admin:', err.message));
  }

  return {
    status: 'completed',
    order_id: payment.order_id,
    payment_reference: flwRef,
    order: { ...order, short_id: shortId, status: 'confirmed' },
  };
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod, reference, isRental }) {
  const typeLabel = isRental ? 'Monthly Rental' : 'Purchase';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:#3D3530;padding:28px 32px;text-align:center">
        <h1 style="color:#EBE6DD;margin:0;font-size:22px;letter-spacing:2px">MAGENA PILATES</h1>
      </div>
      <div style="background:#6B5C53;padding:24px 32px;text-align:center">
        <p style="color:rgba(235,230,221,0.8);font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px">Pre-Order Confirmed</p>
        <h2 style="color:#EBE6DD;margin:0;font-size:22px">${shortId}</h2>
      </div>
      <div style="padding:36px 32px">
        <p style="color:#555;margin:0 0 24px;font-size:15px">
          Hi <strong>${order.customer_name}</strong>, your pre-order is confirmed and payment received. We'll be in touch when your equipment is ready!
        </p>
        <table style="background:#F7F4F0;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;width:150px">Order ID</td><td style="padding:8px 12px;font-weight:bold;font-size:14px;color:#3D3530">${shortId}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Product</td><td style="padding:8px 12px;font-size:14px">${order.product_name}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Order Type</td><td style="padding:8px 12px;font-size:14px">${typeLabel}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Quantity</td><td style="padding:8px 12px;font-size:14px">${order.quantity}</td></tr>
          ${order.wants_engraving ? `<tr><td style="padding:8px 12px;color:#888;font-size:13px">Engraving</td><td style="padding:8px 12px;font-size:14px;color:#22c55e">FREE Logo Engraving included</td></tr>` : ''}
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Amount Paid</td><td style="padding:8px 12px;font-weight:bold;font-size:16px;color:#22c55e">KES ${Number(amountPaid).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Payment</td><td style="padding:8px 12px;font-size:14px">${paymentMethod}</td></tr>
          ${reference ? `<tr><td style="padding:8px 12px;color:#888;font-size:13px">Reference</td><td style="padding:8px 12px;font-size:14px">${reference}</td></tr>` : ''}
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Delivery To</td><td style="padding:8px 12px;font-size:14px">${order.customer_address || 'Not specified'}</td></tr>
        </table>
        <div style="background:#F0FDF4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:4px;margin:24px 0 0;font-size:13px;color:#166534">
          <strong>What's next?</strong> We'll contact you at ${order.customer_email} with delivery timelines and final details. Keep this email as your receipt.
        </div>
      </div>
      <div style="background:#F7F4F0;padding:20px 32px;text-align:center;border-top:1px solid #eee">
        <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Magena Pilates · Nairobi, Kenya</p>
        <p style="color:#aaa;font-size:12px;margin:6px 0 0">Questions? Email us at ${process.env.ADMIN_EMAIL || 'info@magenapilates.com'}</p>
      </div>
    </div>
  `;
}

function buildAdminNotificationEmail({ order, shortId, amountPaid, isRental }) {
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
        <tr><td style="padding:6px 0;color:#888">Address</td><td style="padding:6px 0">${order.customer_address || '—'}</td></tr>
        ${order.notes ? `<tr><td style="padding:6px 0;color:#888">Notes</td><td style="padding:6px 0">${order.notes}</td></tr>` : ''}
      </table>
    </div>
  `;
}
