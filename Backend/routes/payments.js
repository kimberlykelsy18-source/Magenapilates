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

  // ── Flutterwave Webhook ───────────────────────────────────────────────────
  // Register in Flutterwave Dashboard > Settings > Webhooks.
  // Set "Secret Hash" in dashboard = FLW_WEBHOOK_HASH in .env.
  // Webhook URL to register: {BACKEND_URL}/flutterwave/webhook
  //
  // Both v4 and v3 send to the same webhook URL.
  // Distinguish by:
  //   v4 purchase:  event.data.reference  (set by us as txRef = shortId)
  //   v3 rental:    event.data.tx_ref     (set by us as `r-{orderId}`)
  router.post('/flutterwave/webhook', express.json(), async (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_HASH?.trim();
    const signature  = req.headers['verif-hash'];

    if (!secretHash || signature !== secretHash) {
      console.warn('[FLW Webhook] Invalid signature — ignoring');
      return res.status(401).send('Unauthorized');
    }

    const event = req.body;
    const eventType = event?.event;
    console.log('[FLW Webhook]', eventType, '| ref:', event?.data?.reference || event?.data?.tx_ref);

    // Acknowledge immediately — Flutterwave expects 200 within seconds
    res.status(200).send('OK');

    try {
      if (eventType === 'charge.completed') {
        const isTxRef = !!event.data?.tx_ref; // v3 rental has tx_ref
        if (isTxRef) {
          await handleV3RentalCharge(event.data, db, transporter);
        } else {
          await handleV4PurchaseCharge(event.data, db, transporter);
        }
      } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.suspended') {
        await handleSubscriptionCancelled(event, db, transporter);
      } else {
        console.log('[FLW Webhook] Unhandled event:', eventType);
      }
    } catch (err) {
      console.error('[FLW Webhook] Handler error:', err.message);
    }
  });

  // ── GET /api/flutterwave/status ──────────────────────────────────────────
  // Poll endpoint — called by frontend after payment completes.
  //
  // Purchase (v4): GET /api/flutterwave/status?tx_ref=PRE-A001&charge_id=xxx
  // Rental   (v3): GET /api/flutterwave/status?tx_ref=r-{uuid}&transaction_id=XXX&status=successful
  router.get('/api/flutterwave/status', async (req, res) => {
    const { tx_ref, charge_id, transaction_id } = req.query;

    if (!tx_ref) return res.status(400).json({ error: 'tx_ref required' });

    try {
      const { data: payment } = await db
        .from('payments')
        .select('id, order_id, status, payment_reference, flw_plan_id')
        .eq('checkout_request_id', tx_ref)
        .maybeSingle();

      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      // Already confirmed (webhook processed it first)
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

      // v3 rental: tx_ref starts with 'r-', verify using transaction_id
      const isRentalTxRef = tx_ref.startsWith('r-');

      if (isRentalTxRef && transaction_id) {
        const result = await handleV3RentalCharge({ id: Number(transaction_id), tx_ref }, db, transporter);
        return res.json(result);
      }

      // v4 purchase: verify using charge_id (stored in flw_plan_id column)
      const flwChargeId = charge_id || payment.flw_plan_id;
      if (!isRentalTxRef && flwChargeId) {
        const result = await handleV4PurchaseCharge({ id: flwChargeId, reference: tx_ref }, db, transporter);
        return res.json(result);
      }

      return res.json({ status: 'pending' });
    } catch (err) {
      console.error('[FLW status]', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ── v4 Purchase: verify via getCharge ─────────────────────────────────────────
async function handleV4PurchaseCharge(chargeData, db, transporter) {
  const chargeId = chargeData.id;
  const txRef    = chargeData.reference;

  let charge;
  try {
    charge = await flw.getCharge(chargeId);
  } catch (err) {
    console.error('[FLW v4] getCharge failed:', err.message);
    return { status: 'pending' };
  }

  const lookupRef = txRef || charge.reference;
  return processConfirmedPayment({ charge, lookupRef, db, transporter, isV3: false });
}

// ── v3 Rental: verify via verifyTransaction ───────────────────────────────────
// This handles BOTH the first checkout payment AND recurring auto-charges.
async function handleV3RentalCharge(chargeData, db, transporter) {
  const transactionId = chargeData.id;
  const txRef         = chargeData.tx_ref;

  let tx;
  try {
    tx = await flw.verifyTransaction(transactionId);
  } catch (err) {
    console.error('[FLW v3] verifyTransaction failed:', err.message);
    return { status: 'pending' };
  }

  // For recurring auto-charges, tx_ref is auto-generated by Flutterwave.
  // Try to match by the original tx_ref (r-{orderId}), fall back to customer email.
  const lookupRef = txRef || tx.tx_ref;

  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status, amount, flw_plan_id')
    .eq('checkout_request_id', lookupRef)
    .maybeSingle();

  if (payment) {
    // First rental payment or already tracked
    return processConfirmedPayment({ charge: tx, lookupRef, db, transporter, isV3: true, payment });
  }

  // Recurring auto-charge (Flutterwave used a new tx_ref) — match by customer email
  const customerEmail = tx.customer?.email;
  if (!customerEmail) {
    console.warn('[FLW v3] Recurring charge — no customer email, tx_ref:', tx.tx_ref);
    return { status: 'not_found' };
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

  const chargeOk = tx.status === 'successful';
  console.log(`[FLW v3] Recurring charge ${chargeOk ? 'SUCCESS' : 'FAILED'} for ${customerEmail} | amount: ${tx.amount}`);

  // Notify admin of every recurring charge
  if (process.env.ADMIN_EMAIL) {
    const shortId = rentalOrder ? toShortOrderId(rentalOrder.order_number) : 'unknown';
    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `Rental ${chargeOk ? 'Payment Received' : 'PAYMENT FAILED'} — ${shortId}`,
      html: buildRecurringEmail({ customerEmail, customerName: rentalOrder?.customer_name, shortId, amount: tx.amount, flwRef: tx.flw_ref, chargeOk }),
    }).catch((e) => console.error('[FLW email] Recurring:', e.message));
  }

  return { status: chargeOk ? 'completed' : 'failed' };
}

// ── Shared payment confirmation logic ─────────────────────────────────────────
async function processConfirmedPayment({ charge, lookupRef, db, transporter, isV3, payment: existingPayment }) {
  const { data: payment } = existingPayment
    ? { data: existingPayment }
    : await db.from('payments').select('id, order_id, status, amount, flw_plan_id').eq('checkout_request_id', lookupRef).maybeSingle();

  if (!payment) {
    console.warn('[FLW] No payment found for ref:', lookupRef);
    return { status: 'not_found' };
  }

  if (payment.status === 'paid') {
    const { data: order } = await db.from('pre_orders').select('id, order_number, product_name, order_type, total_amount, deposit_amount, customer_name, customer_email, status').eq('id', payment.order_id).single();
    return { status: 'completed', order_id: payment.order_id, order: order ? { ...order, short_id: toShortOrderId(order.order_number) } : null };
  }

  const chargeStatus = charge.status;
  const isSuccess = chargeStatus === 'succeeded' || chargeStatus === 'successful';
  const isFailed  = chargeStatus === 'failed';

  if (isFailed) {
    await db.from('payments').update({ status: 'failed', failure_reason: charge.processor_response || 'Payment failed' }).eq('id', payment.id);
    await db.from('pre_orders').update({ status: 'cancelled' }).eq('id', payment.order_id);
    return { status: 'failed' };
  }

  if (!isSuccess) return { status: 'pending' };

  // ── Success ────────────────────────────────────────────────────────────────
  const flwRef = isV3 ? (charge.flw_ref || null) : (charge.flw_ref || charge.id?.toString() || null);

  await db.from('payments').update({ status: 'paid', payment_reference: flwRef }).eq('id', payment.id);
  const { data: order } = await db.from('pre_orders').select('*').eq('id', payment.order_id).single();
  await db.from('pre_orders').update({ status: 'confirmed' }).eq('id', payment.order_id);

  const shortId    = toShortOrderId(order?.order_number);
  const amountPaid = charge.amount || payment.amount;
  const isRental   = order?.order_type === 'rental';

  if (order?.customer_email) {
    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: order.customer_email,
      subject: `Order Confirmed — ${shortId} · Magena Pilates`,
      html: buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod: charge.payment_type || 'Card', reference: flwRef, isRental }),
    }).catch((e) => console.error('[FLW email] Customer:', e.message));
  }

  if (process.env.ADMIN_EMAIL) {
    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Confirmed Pre-Order — ${shortId}`,
      html: buildAdminEmail({ order, shortId, amountPaid, isRental, planId: payment.flw_plan_id }),
    }).catch((e) => console.error('[FLW email] Admin:', e.message));
  }

  return { status: 'completed', order_id: payment.order_id, payment_reference: flwRef, order: { ...order, short_id: shortId, status: 'confirmed' } };
}

// ── Subscription cancelled webhook ────────────────────────────────────────────
async function handleSubscriptionCancelled(event, db, transporter) {
  const planId        = event?.data?.plan?.id?.toString();
  const customerEmail = event?.data?.customer?.email;
  console.log('[FLW v3] subscription.cancelled | plan_id:', planId, '| email:', customerEmail);

  if (!planId) return;

  const { data: payment } = await db.from('payments').select('id, order_id').eq('flw_plan_id', planId).maybeSingle();
  if (!payment) return;

  await db.from('payments').update({ failure_reason: 'Subscription cancelled' }).eq('id', payment.id);
  const { data: order } = await db.from('pre_orders').select('order_number, customer_name, product_name').eq('id', payment.order_id).single();
  const shortId = toShortOrderId(order?.order_number);

  if (process.env.ADMIN_EMAIL) {
    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `Rental Subscription Cancelled — ${shortId}`,
      html: `<div style="font-family:sans-serif;padding:24px"><h3>Subscription Cancelled</h3><p>Customer: ${order?.customer_name || customerEmail}</p><p>Product: ${order?.product_name}</p><p>Order: ${shortId}</p><p>Plan ID: ${planId}</p></div>`,
    }).catch((e) => console.error('[FLW email] Sub cancelled:', e.message));
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod, reference, isRental }) {
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
          <tr><td style="padding:8px 12px;color:#888;font-size:13px">Payment</td><td style="padding:8px 12px;font-size:14px">${paymentMethod}</td></tr>
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

function buildAdminEmail({ order, shortId, amountPaid, isRental, planId }) {
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
        ${isRental && planId ? `<tr><td style="padding:6px 0;color:#888">Plan ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${planId}</td></tr>` : ''}
        ${order.notes ? `<tr><td style="padding:6px 0;color:#888">Notes</td><td style="padding:6px 0">${order.notes}</td></tr>` : ''}
      </table>
    </div>`;
}

function buildRecurringEmail({ customerEmail, customerName, shortId, amount, flwRef, chargeOk }) {
  const color = chargeOk ? '#22c55e' : '#ef4444';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:8px;border:1px solid #eee;padding:24px">
      <h2 style="color:${color};margin:0 0 16px">Rental ${chargeOk ? 'Payment Received' : 'PAYMENT FAILED'} — ${shortId}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:130px">Customer</td><td style="padding:6px 0">${customerName || customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0">${customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Amount</td><td style="padding:6px 0;font-weight:bold;color:${color}">KES ${Number(amount).toLocaleString()}</td></tr>
        ${flwRef ? `<tr><td style="padding:6px 0;color:#888">FLW Ref</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${flwRef}</td></tr>` : ''}
      </table>
      ${!chargeOk ? '<p style="color:#ef4444;font-size:13px;margin:16px 0 0">Flutterwave will retry up to 3 more times. If all fail, the subscription is cancelled automatically.</p>' : ''}
    </div>`;
}
