const express = require('express');
const pesapal = require('../services/pesapal');
const { createServiceClient } = require('../config/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id) => UUID_RE.test(id);

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

  // PesaPal IPN — PesaPal calls this GET when payment status changes
  router.get('/pesapal/ipn', async (req, res) => {
    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.query;
    console.log('[PesaPal IPN]', req.query);

    // Pesapal requires us to echo back the notification to acknowledge receipt
    const ipnAck = {
      orderNotificationType: OrderNotificationType || 'IPNCHANGE',
      orderTrackingId: OrderTrackingId || '',
      orderMerchantReference: OrderMerchantReference || '',
      status: 200,
    };

    if (!OrderTrackingId || !isValidUUID(OrderTrackingId)) {
      return res.json(ipnAck);
    }

    // Only process known tracking IDs
    const { data: known } = await db
      .from('payments')
      .select('id')
      .eq('checkout_request_id', OrderTrackingId)
      .maybeSingle();

    if (!known) {
      console.warn('[PesaPal IPN] Unknown OrderTrackingId:', OrderTrackingId);
      return res.json(ipnAck);
    }

    try {
      await handlePesapalPayment(OrderTrackingId, db, transporter);
    } catch (err) {
      console.error('[PesaPal IPN] Handler error:', err.message);
    }

    res.json(ipnAck);
  });

  // Frontend polls this after PesaPal redirect back
  router.get('/api/pesapal/status/:orderTrackingId', async (req, res) => {
    const { orderTrackingId } = req.params;

    if (!isValidUUID(orderTrackingId)) {
      return res.status(400).json({ error: 'Invalid tracking ID format' });
    }

    try {
      const { data: existing } = await db
        .from('payments')
        .select('status, order_id, payment_reference')
        .eq('checkout_request_id', orderTrackingId)
        .maybeSingle();

      if (!existing) return res.status(404).json({ error: 'Payment not found' });

      if (existing.status === 'paid') {
        // Fetch full order for the success page
        const { data: order } = await db
          .from('pre_orders')
          .select('id, order_number, product_name, order_type, quantity, total_amount, deposit_amount, customer_name, customer_email, status')
          .eq('id', existing.order_id)
          .single();

        return res.json({
          status: 'completed',
          order_id: existing.order_id,
          pesapal_tracking_id: orderTrackingId,
          payment_reference: existing.payment_reference,
          order: order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
        });
      }

      const result = await handlePesapalPayment(orderTrackingId, db, transporter);
      return res.json(result);
    } catch (err) {
      console.error('[PesaPal status]', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};

async function handlePesapalPayment(orderTrackingId, db, transporter) {
  const txStatus = await pesapal.getTransactionStatus(orderTrackingId);
  const statusCode = txStatus.status_code;

  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status')
    .eq('checkout_request_id', orderTrackingId)
    .maybeSingle();

  if (!payment) return { status: 'not_found' };
  if (payment.status === 'paid') {
    const { data: order } = await db
      .from('pre_orders')
      .select('id, order_number, product_name, order_type, total_amount, customer_name')
      .eq('id', payment.order_id)
      .single();
    return {
      status: 'completed',
      order_id: payment.order_id,
      order: order ? { ...order, short_id: toShortOrderId(order.order_number) } : null,
    };
  }

  if (statusCode === 1) {
    // COMPLETED
    await db.from('payments').update({
      status: 'paid',
      payment_reference: txStatus.confirmation_code || null,
    }).eq('id', payment.id);

    const { data: order } = await db
      .from('pre_orders')
      .select('*')
      .eq('id', payment.order_id)
      .single();

    await db.from('pre_orders').update({ status: 'confirmed' }).eq('id', payment.order_id);

    const shortId = toShortOrderId(order?.order_number);
    const amountPaid = txStatus.amount || order?.total_amount + (order?.deposit_amount || 0);

    // Confirmation email to customer
    if (order?.customer_email) {
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
        to: order.customer_email,
        subject: `Order Confirmed — ${shortId} · Magena Pilates`,
        html: buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod: txStatus.payment_method || 'Card', reference: txStatus.confirmation_code }),
      }).catch((err) => console.error('[PesaPal email] Customer:', err.message));
    }

    // Notification email to admin
    if (process.env.ADMIN_EMAIL) {
      transporter.sendMail({
        from: `"Magena Pilates" <${process.env.GMAIL_EMAIL}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `New Confirmed Pre-Order — ${shortId}`,
        html: buildAdminNotificationEmail({ order, shortId, amountPaid }),
      }).catch((err) => console.error('[PesaPal email] Admin:', err.message));
    }

    return {
      status: 'completed',
      order_id: payment.order_id,
      pesapal_tracking_id: orderTrackingId,
      payment_reference: txStatus.confirmation_code || null,
      order: { ...order, short_id: shortId, status: 'confirmed' },
    };

  } else if (statusCode === 2) {
    // FAILED
    await db.from('payments').update({
      status: 'failed',
      failure_reason: txStatus.payment_status_description || 'Payment failed',
    }).eq('id', payment.id);
    await db.from('pre_orders').update({ status: 'failed' }).eq('id', payment.order_id);
    return { status: 'failed' };

  } else if (statusCode === 3) {
    // REVERSED
    await db.from('payments').update({ status: 'failed', failure_reason: 'Payment reversed' }).eq('id', payment.id);
    return { status: 'reversed' };
  }

  return { status: 'pending' };
}

function buildConfirmationEmail({ order, shortId, amountPaid, paymentMethod, reference }) {
  const typeLabel = order.order_type === 'purchase' ? 'Purchase' : 'Monthly Rental';
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

function buildAdminNotificationEmail({ order, shortId, amountPaid }) {
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
