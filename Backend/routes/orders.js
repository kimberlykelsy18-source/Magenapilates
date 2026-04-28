const express = require('express');
const paystack = require('../services/paystack');
const { buildInvoiceEmail } = require('../config/emailTemplates');

function toShortOrderId(n) {
  if (!n) return 'PRE-???';
  const letterIndex = Math.floor((n - 1) / 999);
  const numPart = ((n - 1) % 999) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
}

module.exports = ({ supabase, serviceSupabase, transporter }) => {
  const router = express.Router();

  // Public — get order by ID
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

  // ── POST /api/orders ────────────────────────────────────────────────────────
  //
  //  Any       + card  →  Paystack hosted checkout (redirect to authorization_url)
  //                        PURCHASE: initializeTransaction only
  //                        RENTAL:   createPlan first, then initializeTransaction with plan
  //                        Returns: { redirect_url, reference }
  //
  //  Any       + mpesa →  Manual paybill (admin confirms payment)
  //                        Returns: { order_id, payment_method, mpesa_paybill }
  //
  router.post('/api/orders', async (req, res) => {
    const {
      product_id, product_name, order_type, quantity, wants_engraving,
      customer_name, customer_email, customer_phone, customer_address,
      notes, total_amount, deposit_amount, payment_method,
    } = req.body;

    if (!product_id || !product_name || !order_type || !customer_name || !customer_email || !customer_phone || !total_amount || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: order, error: orderError } = await serviceSupabase
      .from('pre_orders')
      .insert({
        product_id, product_name, order_type,
        quantity: quantity || 1,
        wants_engraving: wants_engraving || false,
        customer_name, customer_email, customer_phone,
        customer_address, notes,
        total_amount,
        deposit_amount: deposit_amount || 0,
        payment_method,
        status: 'pending_payment',
      })
      .select()
      .single();

    if (orderError) {
      console.error('[Orders] Insert error:', orderError.message);
      return res.status(500).json({ error: orderError.message });
    }

    const shortId   = toShortOrderId(order.order_number);
    const amountDue = Number(total_amount) + Number(deposit_amount || 0);

    // ── CARD → Paystack hosted checkout ─────────────────────────────────────
    if (payment_method === 'card') {
      const reference = paystack.makeReference(shortId);

      try {
        let planCode = null;

        // Rental: create a subscription plan first (5 monthly charges)
        if (order_type === 'rental') {
          const plan = await paystack.createPlan({
            name:          `${product_name} — Monthly Rental (${shortId})`,
            amount:        Number(total_amount), // monthly rate only (deposit charged separately on checkout)
            interval:      'monthly',
            invoice_limit: 5,
          });
          planCode = plan.plan_code;
          console.log(`[Orders] Paystack rental plan ${planCode} created for ${shortId}`);
        }

        const tx = await paystack.initializeTransaction({
          email:        customer_email,
          amount:       amountDue,
          reference,
          plan:         planCode || undefined,
          callback_url: `${process.env.FRONTEND_URL}/order-success`,
          metadata: {
            order_id: order.id,
            short_id: shortId,
            customer: customer_name,
          },
        });

        await serviceSupabase.from('payments').insert({
          order_id:            order.id,
          checkout_request_id: reference,
          amount:              amountDue,
          payment_method:      'card',
          status:              'pending',
          flw_plan_id:         planCode, // column repurposed for Paystack plan code
        });

        return res.status(201).json({
          order_id:     order.id,
          short_id:     shortId,
          redirect_url: tx.authorization_url, // fallback if popup is unavailable
          access_code:  tx.access_code,
          reference,
          ...(planCode && { plan_code: planCode }),
        });

      } catch (err) {
        console.error('[Orders] Paystack error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── M-PESA — manual paybill flow ─────────────────────────────────────────
    if (payment_method === 'mpesa') {
      if (customer_email && transporter) {
        const emailAmount = Number(total_amount) + Number(deposit_amount || 0);
        transporter.sendMail({
          from:    `"Magena Pilates" <${process.env.RESEND_FROM || 'noreply@magenapilates.com'}>`,
          to:      customer_email,
          subject: `Invoice ${shortId} — Magena Pilates`,
          html:    buildInvoiceEmail({ order, shortId, amountPaid: emailAmount, isRental: order_type === 'rental', isPending: true }),
        }).catch((e) => console.error('[Orders] M-PESA invoice email error:', e.message));
      }

      return res.status(201).json({
        order_id:       order.id,
        short_id:       shortId,
        payment_method: 'mpesa',
        mpesa_paybill:  process.env.MPESA_PAYBILL || '',
        message:        'Order received. Please pay via M-PESA paybill using your order ID as the account number.',
      });
    }

    res.status(400).json({ error: 'Unsupported payment method' });
  });

  return router;
};
