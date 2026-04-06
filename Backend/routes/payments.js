const express = require('express');
const flutterwave = require('../services/flutterwave');
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
  // Flutterwave POSTs here for every charge event (one-time and subscription).
  // Register this URL in Flutterwave Dashboard > Settings > Webhooks.
  // Set the "Secret Hash" in the dashboard to match FLW_WEBHOOK_HASH in .env.
  router.post('/flutterwave/webhook', express.json(), async (req, res) => {
    // Verify webhook authenticity — Flutterwave sends the hash in verif-hash header
    const secretHash = process.env.FLW_WEBHOOK_HASH?.trim();
    const signature = req.headers['verif-hash'];

    if (!secretHash || signature !== secretHash) {
      console.warn('[FLW Webhook] Invalid signature — ignoring');
      return res.status(401).send('Unauthorized');
    }

    const event = req.body;
    console.log('[FLW Webhook] Event:', event?.event, '| tx_ref:', event?.data?.tx_ref);

    // Acknowledge immediately so Flutterwave doesn't retry
    res.status(200).send('OK');

    try {
      const eventType = event?.event;

      if (eventType === 'charge.completed') {
        // Handles both:
        //   - First payment (our tx_ref = mgn-{orderId}): confirm order, send email
        //   - Recurring subscription charge (auto-generated tx_ref): log + notify admin
        await handleChargeCompleted(event.data, db, transporter);
      } else if (
        eventType === 'subscription.cancelled' ||
        eventType === 'subscription.suspended'
      ) {
        await handleSubscriptionEvent(event, db, transporter);
      } else {
        console.log('[FLW Webhook] Unhandled event type:', eventType);
      }
    } catch (err) {
      console.error('[FLW Webhook] Handler error:', err.message);
    }
  });

  // ── Frontend status poll — called after Flutterwave redirect ──────────────
  // Flutterwave redirects to /order-success?transaction_id=XXX&tx_ref=mgn-{uuid}&status=successful
  router.get('/api/flutterwave/status', async (req, res) => {
    const { transaction_id, tx_ref, status: flwStatus } = req.query;

    if (!tx_ref) {
      return res.status(400).json({ error: 'Missing tx_ref' });
    }

    try {
      // Check our DB first — webhook may have already processed it
      const { data: payment } = await db
        .from('payments')
        .select('id, order_id, status, payment_reference, flw_plan_id')
        .eq('checkout_request_id', tx_ref)
        .maybeSingle();

      if (!payment) return res.status(404).json({ error: 'Payment record not found' });

      if (payment.status === 'paid') {
        const { data: order } = await db
          .from('pre_orders')
          .select('id, order_number, product_name, order_type, quantity, total_amount, deposit_amount, customer_name, customer_email, status')
          .eq('id', payment.order_id)
          .single();

        return res.json({
          status: 'completed',
          order_id: payment.order_id,
          transaction_id,
          tx_ref,
          payment_reference: payment.payment_reference,
          order: order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
        });
      }

      // Not yet confirmed — verify directly with Flutterwave if we have a transaction_id
      if (transaction_id && flwStatus === 'successful') {
        const result = await handleChargeCompleted(
          { id: transaction_id, tx_ref },
          db,
          transporter
        );
        return res.json(result);
      }

      // Payment still pending (or cancelled/failed redirect)
      if (flwStatus === 'cancelled' || flwStatus === 'failed') {
        await db.from('payments').update({ status: 'failed', failure_reason: `Customer ${flwStatus}` }).eq('id', payment.id);
        await db.from('pre_orders').update({ status: 'cancelled' }).eq('id', payment.order_id);
        return res.json({ status: 'failed' });
      }

      return res.json({ status: 'pending' });
    } catch (err) {
      console.error('[FLW status]', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ── Shared handlers ───────────────────────────────────────────────────────────

async function handleChargeCompleted(txData, db, transporter) {
  const transactionId = txData.id;
  const txRef = txData.tx_ref;
  const customerEmail = txData.customer?.email;

  if (!txRef) return { status: 'invalid' };

  // Verify with Flutterwave (uses v4)
  let tx;
  try {
    tx = await flutterwave.verifyTransaction(transactionId);
  } catch (err) {
    console.error('[FLW] verifyTransaction failed:', err.message);
    return { status: 'pending' };
  }

  // ── Try to find our payment record by tx_ref (first / one-time payment) ────
  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status, amount, flw_plan_id')
    .eq('checkout_request_id', txRef)
    .maybeSingle();

  if (payment) {
    // ── FIRST PAYMENT (purchase or first rental month) ────────────────────
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

    if (tx.status !== 'successful') {
      if (tx.status === 'failed') {
        await db.from('payments').update({ status: 'failed', failure_reason: tx.processor_response || 'Payment failed' }).eq('id', payment.id);
        await db.from('pre_orders').update({ status: 'cancelled' }).eq('id', payment.order_id);
        return { status: 'failed' };
      }
      return { status: 'pending' };
    }

    await db.from('payments').update({
      status: 'paid',
      payment_reference: tx.flw_ref || tx.id?.toString() || null,
    }).eq('id', payment.id);

    const { data: order } = await db.from('pre_orders').select('*').eq('id', payment.order_id).single();
    await db.from('pre_orders').update({ status: 'confirmed' }).eq('id', payment.order_id);

    const shortId = toShortOrderId(order?.order_number);
    const amountPaid = tx.amount || payment.amount;
    const isRental = order?.order_type === 'rental';

    if (order?.customer_email) {
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
        to: order.customer_email,
        subject: `Order Confirmed — ${shortId} · Magena Pilates`,
        html: buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod: tx.payment_type || 'Card', reference: tx.flw_ref || null, isRental, planId: payment.flw_plan_id }),
      }).catch((err) => console.error('[FLW email] Customer:', err.message));
    }

    if (process.env.ADMIN_EMAIL) {
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `New Confirmed Pre-Order — ${shortId}`,
        html: buildAdminNotificationEmail({ order, shortId, amountPaid, isRental, planId: payment.flw_plan_id }),
      }).catch((err) => console.error('[FLW email] Admin:', err.message));
    }

    return {
      status: 'completed',
      order_id: payment.order_id,
      transaction_id: tx.id,
      tx_ref: txRef,
      payment_reference: tx.flw_ref || null,
      order: { ...order, short_id: shortId, status: 'confirmed' },
    };
  }

  // ── RECURRING SUBSCRIPTION CHARGE (months 2–5, auto-generated tx_ref) ────
  // Flutterwave generates a new tx_ref per recurring charge; match by customer email + plan.
  if (!customerEmail) {
    console.warn('[FLW] Recurring charge with no customer email, tx_ref:', txRef);
    return { status: 'not_found' };
  }

  // Find active subscription payment for this customer (has a flw_plan_id)
  const { data: subPayment } = await db
    .from('payments')
    .select('id, order_id, flw_plan_id')
    .not('flw_plan_id', 'is', null)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    // Match by customer email via the related pre_order
    .maybeSingle();

  // Cross-check email via the order
  let matchedPayment = null;
  if (subPayment) {
    const { data: relOrder } = await db
      .from('pre_orders')
      .select('customer_email')
      .eq('id', subPayment.order_id)
      .single();
    if (relOrder?.customer_email === customerEmail) {
      matchedPayment = subPayment;
    }
  }

  if (!matchedPayment) {
    // Fallback: find via order email directly
    const { data: orderByEmail } = await db
      .from('pre_orders')
      .select('id')
      .eq('customer_email', customerEmail)
      .eq('order_type', 'rental')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderByEmail) {
      const { data: p } = await db
        .from('payments')
        .select('id, order_id, flw_plan_id')
        .eq('order_id', orderByEmail.id)
        .not('flw_plan_id', 'is', null)
        .maybeSingle();
      matchedPayment = p;
    }
  }

  const chargeStatus = tx.status === 'successful' ? 'paid' : 'failed';
  console.log(`[FLW Recurring] ${chargeStatus} charge for ${customerEmail} | flw_ref: ${tx.flw_ref} | amount: ${tx.amount}`);

  // Notify admin of every recurring charge (success or failure)
  if (process.env.ADMIN_EMAIL) {
    const orderInfo = matchedPayment
      ? await db.from('pre_orders').select('order_number, product_name, customer_name').eq('id', matchedPayment.order_id).single().then((r) => r.data)
      : null;
    const shortId = orderInfo ? toShortOrderId(orderInfo.order_number) : 'unknown';

    transporter.sendMail({
      from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `Rental Subscription ${chargeStatus === 'paid' ? 'Payment Received' : 'PAYMENT FAILED'} — ${shortId}`,
      html: buildRecurringChargeEmail({ customerEmail, customerName: orderInfo?.customer_name, shortId, amount: tx.amount, currency: tx.currency, flwRef: tx.flw_ref, chargeStatus }),
    }).catch((err) => console.error('[FLW email] Recurring admin:', err.message));
  }

  return { status: chargeStatus === 'paid' ? 'completed' : 'failed' };
}

async function handleSubscriptionEvent(event, db, transporter) {
  const planId = event?.data?.plan?.id?.toString();
  const customerEmail = event?.data?.customer?.email;

  console.log('[FLW Subscription]', event.event, '| plan_id:', planId, '| email:', customerEmail);

  if (!planId) return;

  const { data: payment } = await db
    .from('payments')
    .select('id, order_id')
    .eq('flw_plan_id', planId)
    .maybeSingle();

  if (!payment) {
    console.warn('[FLW Subscription] No payment record for plan_id:', planId);
    return;
  }

  if (event.event === 'subscription.cancelled') {
    await db.from('payments').update({ failure_reason: 'Subscription cancelled by Flutterwave' }).eq('id', payment.id);

    const { data: order } = await db.from('pre_orders').select('order_number, customer_name, product_name').eq('id', payment.order_id).single();
    const shortId = toShortOrderId(order?.order_number);
    console.log(`[FLW Subscription] Plan ${planId} cancelled for order ${shortId}`);

    if (process.env.ADMIN_EMAIL) {
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `Rental Subscription Cancelled — ${shortId}`,
        html: `<div style="font-family:sans-serif;padding:24px"><h3>Subscription Cancelled</h3><p>Customer: ${order?.customer_name || customerEmail}</p><p>Product: ${order?.product_name}</p><p>Order: ${shortId}</p><p>Plan ID: ${planId}</p></div>`,
      }).catch((err) => console.error('[FLW email] Sub cancelled:', err.message));
    }
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod, reference, isRental, planId }) {
  const typeLabel = isRental ? 'Monthly Rental' : 'Purchase';
  const subscriptionNote = isRental && planId
    ? `<div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:13px;color:#1E40AF">
        <strong>Subscription active:</strong> Your monthly rental payments are set up automatically. You'll be charged each month — no action needed.
       </div>`
    : '';

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

        ${subscriptionNote}

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

function buildAdminNotificationEmail({ order, shortId, amountPaid, isRental, planId }) {
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
        ${isRental && planId ? `<tr><td style="padding:6px 0;color:#888">Subscription Plan ID</td><td style="padding:6px 0;font-size:12px;font-family:monospace">${planId}</td></tr>` : ''}
        ${order.notes ? `<tr><td style="padding:6px 0;color:#888">Notes</td><td style="padding:6px 0">${order.notes}</td></tr>` : ''}
      </table>
    </div>
  `;
}

function buildRecurringChargeEmail({ customerEmail, customerName, shortId, amount, currency, flwRef, chargeStatus }) {
  const isPaid = chargeStatus === 'paid';
  const color = isPaid ? '#22c55e' : '#ef4444';
  const label = isPaid ? 'Payment Received' : 'PAYMENT FAILED';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:8px;border:1px solid #eee;padding:24px">
      <h2 style="color:${color};margin:0 0 16px">Rental Subscription — ${label}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:130px">Order</td><td style="padding:6px 0;font-weight:bold">${shortId}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Customer</td><td style="padding:6px 0">${customerName || customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0">${customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Amount</td><td style="padding:6px 0;font-weight:bold;color:${color}">${currency || 'KES'} ${Number(amount).toLocaleString()}</td></tr>
        ${flwRef ? `<tr><td style="padding:6px 0;color:#888">FLW Ref</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${flwRef}</td></tr>` : ''}
      </table>
      ${!isPaid ? '<p style="color:#ef4444;font-size:13px;margin:16px 0 0">Flutterwave will retry 3 more times. If all fail, the subscription is cancelled automatically.</p>' : ''}
    </div>
  `;
}
