'use strict';

const VAT_RATE = 0.16;

function buildInvoiceEmail({ order, shortId, amountPaid, reference, isRental = false, isPending = false }) {
  const invoiceDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const statusColor  = isPending ? '#B45309' : '#22c55e';
  const statusBg     = isPending ? '#FEF3C7' : '#F0FDF4';
  const statusBorder = isPending ? '#F59E0B' : '#22c55e';

  let subtotal = Math.round(Number(amountPaid));
  let vatAmount = 0;
  let vatRow = '';
  if (!isRental) {
    subtotal  = Math.round(Number(amountPaid) / (1 + VAT_RATE));
    vatAmount = Number(amountPaid) - subtotal;
    vatRow = `
      <tr>
        <td colspan="3" style="padding:8px 12px;text-align:right;color:#555;font-size:13px;border-top:1px solid #e5e5e5">Value-Added Tax (16%)</td>
        <td style="padding:8px 12px;text-align:right;font-size:13px;color:#555;border-top:1px solid #e5e5e5"><strong>KES ${vatAmount.toLocaleString()}</strong></td>
      </tr>`;
  }

  const paymentDetails = isPending ? `
    <div style="margin:24px 0 0;padding:18px 20px;background:#F7F4F0;border-radius:4px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#3D3530">
      <div style="font-weight:bold;margin-bottom:10px;font-size:14px">How to Pay via M-PESA:</div>
      <ol style="margin:0;padding-left:18px;line-height:2">
        <li>Go to M-PESA on your phone</li>
        <li>Select <strong>Lipa na M-PESA</strong>, then select <strong>Paybill</strong></li>
        <li>Enter Business Number: <strong>${process.env.MPESA_PAYBILL || '522533'}</strong></li>
        <li>Enter Account Number: <strong>${shortId}</strong></li>
        <li>Enter Amount: <strong>KES ${Number(amountPaid).toLocaleString()}</strong></li>
        <li>Enter your M-PESA PIN and confirm</li>
      </ol>
    </div>` : '';

  const termsSection = `
    <div style="margin:20px 0 0;font-family:'Helvetica Neue',sans-serif;font-size:12px;color:#555">
      <div style="font-weight:bold;margin-bottom:6px;color:#3D3530">T&amp;Cs:</div>
      <div>A 100% payment upfront is required for work to begin</div>
      <div>Estimated delivery time is 20 days after confirmation and receipt of payment</div>
    </div>`;

  const rentalNote = isRental
    ? `<div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:12px 16px;margin:0 0 16px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#1E40AF"><strong>Subscription active:</strong> Monthly payments are set up automatically. No action needed each month.</div>`
    : '';

  const depositRow = Number(order.deposit_amount) > 0 ? `
        <tr>
          <td colspan="3" style="padding:8px 12px;text-align:right;color:#555;font-size:13px">Refundable Deposit</td>
          <td style="padding:8px 12px;text-align:right;font-size:13px"><strong>KES ${Number(order.deposit_amount).toLocaleString()}</strong></td>
        </tr>` : '';

  const customRow = (order.leather_finish || order.wood_finish || order.engraving_text || order.height_range) ? `
        <tr style="background:#fafafa">
          <td colspan="4" style="padding:8px 12px;font-size:12px;color:#666">
            ${order.leather_finish ? `Leather: <strong>${order.leather_finish}</strong>` : ''}
            ${order.wood_finish ? ` &nbsp;·&nbsp; Wood: <strong>${order.wood_finish}</strong>` : ''}
            ${order.engraving_text ? ` &nbsp;·&nbsp; Engraving: <strong>"${order.engraving_text}"</strong>` : ''}
            ${order.height_range ? ` &nbsp;·&nbsp; Height: <strong>${order.height_range}</strong>` : ''}
          </td>
        </tr>` : '';

  return `
<div style="font-family:'Georgia',serif;max-width:600px;margin:auto;background:#fff;border:1px solid #ddd">
  <div style="text-align:center;padding:32px 40px 24px;border-bottom:2px solid #3D3530">
    <div style="font-family:'Helvetica Neue',sans-serif;letter-spacing:8px;font-size:22px;font-weight:400;color:#3D3530;margin-bottom:2px">MAGENA</div>
    <div style="font-family:'Helvetica Neue',sans-serif;letter-spacing:10px;font-size:12px;color:#3D3530">PILATES</div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:24px 32px;vertical-align:top;width:30%">
        <div style="font-family:'Helvetica Neue',sans-serif;font-size:20px;font-weight:700;letter-spacing:2px;color:#3D3530">INVOICE</div>
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
  <div style="padding:14px 32px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#555">
    <span style="color:#888;margin-right:12px">Description</span>
    <span>${isRental ? 'Monthly rental of' : 'Quote for purchasing'} ${order.product_name}</span>
  </div>
  <div style="border-top:1px solid #e5e5e5;margin:0 32px"></div>
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
          <td style="padding:12px 12px;border-bottom:1px solid #eee">${order.engraving_text ? `"${order.engraving_text}"` : (order.wants_engraving ? 'Yes (FREE)' : 'No')}</td>
          <td style="padding:12px 12px;border-bottom:1px solid #eee;text-align:right">KES ${subtotal.toLocaleString()}</td>
        </tr>
        ${customRow}
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
  <div style="margin:20px 32px 0;padding:10px 16px;background:${statusBg};border-left:4px solid ${statusBorder};font-family:'Helvetica Neue',sans-serif;font-size:13px;color:${statusColor};font-weight:bold">
    ${isPending
      ? 'Awaiting payment — please complete payment using the M-PESA details below.'
      : `Payment confirmed${reference ? ` · Ref: ${reference}` : ''}. Thank you for your order!`}
  </div>
  <div style="padding:0 32px 24px">
    ${paymentDetails}
    ${termsSection}
  </div>
  <div style="padding:20px 40px;border-top:2px solid #3D3530;text-align:center;font-family:'Helvetica Neue',sans-serif;font-size:12px;color:#888">
    <div>For any inquiries please feel free to reach out at <a href="mailto:magenapilates@gmail.com" style="color:#3D3530">magenapilates@gmail.com</a></div>
    <div style="margin-top:4px">Looking forward to business with you :)</div>
  </div>
</div>`;
}

function buildMpesaPendingEmail({ order, shortId }) {
  return `
<div style="font-family:'Helvetica Neue',sans-serif;max-width:600px;margin:auto;background:#fff;border:1px solid #ddd">
  <div style="text-align:center;padding:28px 40px 20px;border-bottom:2px solid #3D3530">
    <div style="letter-spacing:8px;font-size:20px;font-weight:400;color:#3D3530">MAGENA PILATES</div>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#3D3530;margin:0 0 8px">We received your payment — verifying now</h2>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Hi ${order.customer_name}, thank you for your M-PESA payment for <strong>${order.product_name}</strong>.</p>
    <div style="background:#F0FDF4;border-left:4px solid #22c55e;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;font-size:14px;color:#166534"><strong>Your order ID is: ${shortId}</strong></p>
      <p style="margin:6px 0 0;font-size:13px;color:#166534">We are verifying your M-PESA transaction and will confirm your order within 24 hours. You will receive a confirmation email once verified.</p>
    </div>
    <p style="font-size:13px;color:#666;margin:0">If you need to follow up, please contact us with your order ID <strong>${shortId}</strong> and your M-PESA transaction code.</p>
  </div>
  <div style="padding:16px 40px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#888">
    <a href="mailto:magenapilates@gmail.com" style="color:#3D3530">magenapilates@gmail.com</a>
  </div>
</div>`;
}

function buildStatusChangeEmail({ order, shortId, status }) {
  if (status === 'failed') {
    return `
<div style="font-family:'Helvetica Neue',sans-serif;max-width:600px;margin:auto;background:#fff;border:1px solid #ddd">
  <div style="text-align:center;padding:28px 40px 20px;border-bottom:2px solid #3D3530">
    <div style="letter-spacing:8px;font-size:20px;font-weight:400;color:#3D3530">MAGENA PILATES</div>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#ef4444;margin:0 0 8px">Payment Could Not Be Verified</h2>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Hi ${order.customer_name}, we were unable to verify your payment for order <strong>${shortId}</strong> (${order.product_name}).</p>
    <div style="background:#FEF2F2;border-left:4px solid #ef4444;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;font-size:14px;color:#991b1b">Please contact us immediately with your M-PESA transaction code so we can resolve this.</p>
    </div>
    <p style="font-size:13px;color:#666">Email: <a href="mailto:magenapilates@gmail.com" style="color:#3D3530">magenapilates@gmail.com</a></p>
  </div>
</div>`;
  }

  if (status === 'completed') {
    return `
<div style="font-family:'Helvetica Neue',sans-serif;max-width:600px;margin:auto;background:#fff;border:1px solid #ddd">
  <div style="text-align:center;padding:28px 40px 20px;border-bottom:2px solid #3D3530">
    <div style="letter-spacing:8px;font-size:20px;font-weight:400;color:#3D3530">MAGENA PILATES</div>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#3D3530;margin:0 0 8px">Your Equipment is On Its Way!</h2>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Hi ${order.customer_name}, great news! Your <strong>${order.product_name}</strong> (order <strong>${shortId}</strong>) has been dispatched for delivery.</p>
    <div style="background:#F0FDF4;border-left:4px solid #22c55e;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;font-size:14px;color:#166534">Our team will be in touch with specific delivery details. Thank you for choosing Magena Pilates!</p>
    </div>
  </div>
  <div style="padding:16px 40px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#888">
    <a href="mailto:magenapilates@gmail.com" style="color:#3D3530">magenapilates@gmail.com</a>
  </div>
</div>`;
  }

  return '';
}

function buildWaitlistEmail({ name, equipment_interest, message }) {
  return `
<div style="font-family:'Helvetica Neue',sans-serif;max-width:600px;margin:auto;background:#fff;border:1px solid #ddd">
  <div style="text-align:center;padding:28px 40px 20px;border-bottom:2px solid #3D3530">
    <div style="letter-spacing:8px;font-size:20px;font-weight:400;color:#3D3530">MAGENA PILATES</div>
  </div>
  <div style="padding:28px 32px">
    <h2 style="color:#3D3530;margin:0 0 8px">You're on the waitlist!</h2>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Hi ${name}, you've been added to the waitlist for <strong>${equipment_interest}</strong>.</p>
    <div style="background:#F7F4F0;border-left:4px solid #3D3530;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;font-size:14px;color:#3D3530">${message}</p>
    </div>
    <p style="font-size:13px;color:#555;font-style:italic">"Be the first to know when our new equipment is ready."</p>
  </div>
  <div style="padding:16px 40px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#888">
    <a href="mailto:magenapilates@gmail.com" style="color:#3D3530">magenapilates@gmail.com</a>
  </div>
</div>`;
}

function buildAdminEmail({ order, shortId, amountPaid, isRental }) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:8px;border:1px solid #eee;padding:24px">
      <h2 style="color:#3D3530;margin:0 0 16px">New Pre-Order — ${shortId}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#888;width:140px">Customer</td><td style="padding:6px 0">${order.customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td style="padding:6px 0">${order.customer_email}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Phone</td><td style="padding:6px 0">${order.customer_phone}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Country</td><td style="padding:6px 0">${order.customer_country || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Product</td><td style="padding:6px 0">${order.product_name} (${order.order_type})</td></tr>
        <tr><td style="padding:6px 0;color:#888">Qty</td><td style="padding:6px 0">${order.quantity}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Leather</td><td style="padding:6px 0">${order.leather_finish || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Wood</td><td style="padding:6px 0">${order.wood_finish || '—'}</td></tr>
        ${order.engraving_text ? `<tr><td style="padding:6px 0;color:#888">Engraving</td><td style="padding:6px 0">"${order.engraving_text}"</td></tr>` : ''}
        ${order.context_of_use ? `<tr><td style="padding:6px 0;color:#888">Context</td><td style="padding:6px 0">${order.context_of_use}</td></tr>` : ''}
        ${order.business_name ? `<tr><td style="padding:6px 0;color:#888">Business</td><td style="padding:6px 0">${order.business_name}</td></tr>` : ''}
        ${order.kra_pin ? `<tr><td style="padding:6px 0;color:#888">KRA Pin</td><td style="padding:6px 0">${order.kra_pin}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#888">Amount</td><td style="padding:6px 0;font-weight:bold">KES ${Number(amountPaid).toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Type</td><td style="padding:6px 0">${isRental ? 'Monthly Rental' : 'Purchase'}</td></tr>
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

module.exports = { buildInvoiceEmail, buildMpesaPendingEmail, buildStatusChangeEmail, buildWaitlistEmail, buildAdminEmail, buildRecurringEmail };
