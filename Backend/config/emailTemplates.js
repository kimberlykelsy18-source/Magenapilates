'use strict';

const VAT_RATE = 0.16; // 16% VAT applied to purchases

/**
 * Magena Pilates branded invoice / confirmation email.
 *
 * @param {object}  opts
 * @param {object}  opts.order       – full pre_orders row
 * @param {string}  opts.shortId     – formatted order ID e.g. PRE-A001
 * @param {number}  opts.amountPaid  – total charged (VAT-inclusive for purchases)
 * @param {string}  [opts.reference] – Paystack payment reference
 * @param {boolean} [opts.isRental]  – rental orders use no VAT
 * @param {boolean} [opts.isPending] – M-PESA: show payment instructions instead of "paid"
 */
function buildInvoiceEmail({ order, shortId, amountPaid, reference, isRental = false, isPending = false }) {
  const invoiceDate  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const statusLabel  = isPending ? 'INVOICE' : 'INVOICE';
  const statusColor  = isPending ? '#B45309' : '#22c55e';
  const statusBg     = isPending ? '#FEF3C7' : '#F0FDF4';
  const statusBorder = isPending ? '#F59E0B' : '#22c55e';

  // ── VAT breakdown (purchase only) ─────────────────────────────────────────
  let subtotal  = Math.round(Number(amountPaid));
  let vatAmount = 0;
  let vatRow    = '';
  if (!isRental) {
    subtotal  = Math.round(Number(amountPaid) / (1 + VAT_RATE));
    vatAmount = Number(amountPaid) - subtotal;
    vatRow = `
      <tr>
        <td colspan="3" style="padding:8px 12px;text-align:right;color:#555;font-size:13px;border-top:1px solid #e5e5e5">Value-Added Tax (16%)</td>
        <td style="padding:8px 12px;text-align:right;font-size:13px;color:#555;border-top:1px solid #e5e5e5"><strong>KES ${vatAmount.toLocaleString()}</strong></td>
      </tr>`;
  }

  // ── Payment instructions (M-PESA pending only) ────────────────────────────
  const paymentDetails = isPending ? `
    <div style="margin:24px 0 0;padding:18px 20px;background:#F7F4F0;border-radius:4px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#3D3530">
      <div style="font-weight:bold;margin-bottom:10px;font-size:14px">Payment Details:</div>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <tr>
          <td style="padding:3px 0;color:#888;width:130px">M-Pesa Paybill</td>
          <td style="padding:3px 0;font-weight:bold">522533</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:#888">A/C Number</td>
          <td style="padding:3px 0;font-weight:bold">${shortId}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:#888">Account Name</td>
          <td style="padding:3px 0">MAGENA PILATES</td>
        </tr>
      </table>
      <div style="margin-top:12px;border-top:1px solid #ddd;padding-top:12px">
        <div style="font-weight:bold;margin-bottom:6px">Bank to Bank (KCB):</div>
        <table style="border-collapse:collapse;font-size:13px">
          <tr><td style="padding:3px 8px 3px 0;color:#888">A/C Number</td><td style="padding:3px 0">1350386081</td></tr>
        </table>
      </div>
    </div>` : '';

  // ── T&Cs ──────────────────────────────────────────────────────────────────
  const termsSection = `
    <div style="margin:20px 0 0;font-family:'Helvetica Neue',sans-serif;font-size:12px;color:#555">
      <div style="font-weight:bold;margin-bottom:6px;color:#3D3530">T&amp;Cs:</div>
      <div>A 100% payment upfront is required for work to begin</div>
      <div>Estimated delivery time is 20 days after confirmation and receipt of payment</div>
    </div>`;

  // ── Rental note ───────────────────────────────────────────────────────────
  const rentalNote = isRental
    ? `<div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:12px 16px;margin:0 0 16px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#1E40AF"><strong>Subscription active:</strong> Monthly payments are set up automatically. No action needed each month.</div>`
    : '';

  const depositRow = Number(order.deposit_amount) > 0 ? `
        <tr>
          <td colspan="3" style="padding:8px 12px;text-align:right;color:#555;font-size:13px">Refundable Deposit</td>
          <td style="padding:8px 12px;text-align:right;font-size:13px"><strong>KES ${Number(order.deposit_amount).toLocaleString()}</strong></td>
        </tr>` : '';

  return `
<div style="font-family:'Georgia',serif;max-width:600px;margin:auto;background:#fff;border:1px solid #ddd">

  <!-- Logo header -->
  <div style="text-align:center;padding:32px 40px 24px;border-bottom:2px solid #3D3530">
    <div style="font-family:'Helvetica Neue',sans-serif;letter-spacing:8px;font-size:22px;font-weight:400;color:#3D3530;margin-bottom:2px">MAGENA</div>
    <div style="font-family:'Helvetica Neue',sans-serif;letter-spacing:10px;font-size:12px;color:#3D3530">PILATES</div>
  </div>

  <!-- Invoice meta -->
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:24px 32px;vertical-align:top;width:30%">
        <div style="font-family:'Helvetica Neue',sans-serif;font-size:20px;font-weight:700;letter-spacing:2px;color:#3D3530">${statusLabel}</div>
        <div style="font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#888;margin-top:4px">${shortId}</div>
      </td>
      <td style="padding:24px 12px;vertical-align:top;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#555">
        <div style="font-weight:bold;color:#3D3530">${order.customer_name}</div>
        <div>${order.customer_address || ''}</div>
        <div>${order.customer_phone || ''}</div>
      </td>
      <td style="padding:24px 32px;vertical-align:top;text-align:right;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#555;white-space:nowrap">
        <div>Date: ${invoiceDate}</div>
        <div>Invoice #: ${shortId}</div>
      </td>
    </tr>
  </table>

  <div style="border-top:1px solid #e5e5e5;margin:0 32px"></div>

  <!-- Description -->
  <div style="padding:14px 32px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#555">
    <span style="color:#888;margin-right:12px">Description</span>
    <span>${isRental ? 'Monthly rental of' : 'Quote for purchasing'} ${order.product_name}</span>
  </div>

  <div style="border-top:1px solid #e5e5e5;margin:0 32px"></div>

  <!-- Items table -->
  <div style="padding:16px 32px 0">
    ${rentalNote}
    <table style="width:100%;border-collapse:collapse;font-family:'Helvetica Neue',sans-serif;font-size:13px">
      <thead>
        <tr style="background:#7A3B3B;color:#fff">
          <th style="padding:10px 12px;text-align:left;font-weight:500">Item</th>
          <th style="padding:10px 12px;text-align:left;font-weight:500">Quantity</th>
          <th style="padding:10px 12px;text-align:left;font-weight:500">Engraving</th>
          <th style="padding:10px 12px;text-align:right;font-weight:500">Price</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f9f9f9">
          <td style="padding:12px 12px;border-bottom:1px solid #eee">${order.product_name}</td>
          <td style="padding:12px 12px;border-bottom:1px solid #eee">${order.quantity}</td>
          <td style="padding:12px 12px;border-bottom:1px solid #eee">${order.wants_engraving ? 'Yes' : 'No'}</td>
          <td style="padding:12px 12px;border-bottom:1px solid #eee;text-align:right">KES ${subtotal.toLocaleString()}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:8px 12px;text-align:right;color:#555">Subtotal</td>
          <td style="padding:8px 12px;text-align:right"><strong>KES ${subtotal.toLocaleString()}</strong></td>
        </tr>
        ${vatRow}
        ${depositRow}
        <tr style="background:#3D3530">
          <td colspan="3" style="padding:10px 12px;text-align:right;color:#EBE6DD;font-weight:bold">Total</td>
          <td style="padding:10px 12px;text-align:right;color:#EBE6DD;font-weight:bold">KES ${Number(amountPaid).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Status badge -->
  <div style="margin:20px 32px 0;padding:10px 16px;background:${statusBg};border-left:4px solid ${statusBorder};font-family:'Helvetica Neue',sans-serif;font-size:13px;color:${statusColor};font-weight:bold">
    ${isPending
      ? 'Awaiting payment — please complete payment using the details below.'
      : `Payment confirmed${reference ? ` · Ref: ${reference}` : ''}. Thank you for your order!`}
  </div>

  <!-- Payment details / T&Cs -->
  <div style="padding:0 32px 24px">
    ${paymentDetails}
    ${termsSection}
  </div>

  <!-- Footer -->
  <div style="padding:20px 40px;border-top:2px solid #3D3530;text-align:center;font-family:'Helvetica Neue',sans-serif;font-size:12px;color:#888">
    <div>For any inquiries please feel free to reach out at <a href="mailto:magenapilates@gmail.com" style="color:#3D3530">magenapilates@gmail.com</a></div>
    <div style="margin-top:4px">Looking forward to business with you :)</div>
  </div>

</div>`;
}

/**
 * Internal admin notification email — plain tabular format.
 */
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

/**
 * Recurring rental charge notification — admin only.
 */
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

module.exports = { buildInvoiceEmail, buildAdminEmail, buildRecurringEmail };
