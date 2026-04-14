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
  //  PURCHASE  + card  →  Paystack direct card API
  //                        Frontend sends card details → backend charges → PIN/OTP flow
  //                        Returns: { reference, action, url? }
  //
  //  RENTAL    + card  →  Paystack plan + hosted checkout
  //                        Backend creates plan → gets hosted link → redirect customer
  //                        Returns: { redirect_url, reference }
  //
  //  Any       + mpesa →  Manual paybill (confirmed by admin)
  //
  router.post('/api/orders', async (req, res) => {
    const {
      product_id, product_name, order_type, quantity, wants_engraving,
      customer_name, customer_email, customer_phone, customer_address,
      notes, total_amount, deposit_amount, payment_method,
      card, // only required for purchase + card
    } = req.body;

    if (!product_id || !product_name || !order_type || !customer_name || !customer_email || !customer_phone || !total_amount || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert pre-order first (works for all paths)
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

    // ── PURCHASE + CARD → Paystack direct card API ───────────────────────────
    if (payment_method === 'card' && order_type === 'purchase') {
      if (!card?.number || !card?.expiry_month || !card?.expiry_year || !card?.cvv) {
        return res.status(400).json({ error: 'Card details are required for card payments' });
      }

      const reference = paystack.makeReference(shortId);

      try {
        const charge = await paystack.chargeCard({
          email:     customer_email,
          amount:    amountDue,
          reference,
          card,
        });

        await serviceSupabase.from('payments').insert({
          order_id:            order.id,
          checkout_request_id: reference,
          amount:              amountDue,
          payment_method:      'card',
          status:              'pending',
        });

        // Payment immediately successful (e.g. test cards)
        if (charge.status === 'success') {
          return res.status(201).json({ order_id: order.id, short_id: shortId, reference, action: null });
        }

        // Payment rejected outright
        if (charge.status === 'failed') {
          await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
          return res.status(402).json({ error: charge.display_text || 'Card payment failed. Please check your details.' });
        }

        // Requires further action: send_pin, send_otp, open_url, send_phone, send_birthday
        return res.status(201).json({
          order_id:     order.id,
          short_id:     shortId,
          reference,
          action:       charge.status,       // 'send_pin' | 'send_otp' | 'open_url' | etc.
          url:          charge.url || null,  // for open_url (3DS redirect)
          display_text: charge.display_text || null,
        });

      } catch (err) {
        console.error('[Orders] Paystack purchase error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── RENTAL + CARD → Paystack plan + hosted checkout ──────────────────────
    if (payment_method === 'card' && order_type === 'rental') {
      try {
        const rentalAmount = Number(total_amount); // monthly rate (without deposit)
        const reference    = paystack.makeReference(`r-${shortId}`);

        // Step 1: Create subscription plan (5 monthly charges)
        const plan = await paystack.createPlan({
          name:          `${product_name} — Monthly Rental (${shortId})`,
          amount:        rentalAmount,
          interval:      'monthly',
          invoice_limit: 5,
        });

        // Step 2: Initialize hosted checkout with plan attached
        // amountDue = deposit + first month (charged on the hosted page)
        // Subsequent months auto-charged by Paystack via the plan
        const tx = await paystack.initializeTransaction({
          email:        customer_email,
          amount:       amountDue,
          reference,
          plan:         plan.plan_code,
          callback_url: `${process.env.FRONTEND_URL}/order-success`,
          metadata: {
            order_id:  order.id,
            short_id:  shortId,
            customer:  customer_name,
          },
        });

        // Store reference + plan code for webhook matching
        await serviceSupabase.from('payments').insert({
          order_id:            order.id,
          checkout_request_id: reference,
          amount:              amountDue,
          payment_method:      'card',
          status:              'pending',
          flw_plan_id:         plan.plan_code, // column reused for Paystack plan code
        });

        console.log(`[Orders] Paystack rental plan ${plan.plan_code} created for ${shortId}`);

        return res.status(201).json({
          order_id:     order.id,
          short_id:     shortId,
          redirect_url: tx.authorization_url,
          reference,
          plan_code:    plan.plan_code,
        });

      } catch (err) {
        console.error('[Orders] Paystack rental error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── M-PESA — manual paybill flow ─────────────────────────────────────────
    if (payment_method === 'mpesa') {
      // Send pending invoice email to customer immediately
      if (customer_email && transporter) {
        const isRental = order_type === 'rental';
        const emailAmount = Number(total_amount) + Number(deposit_amount || 0);
        transporter.sendMail({
          from:    `"Magena Pilates" <${process.env.RESEND_FROM || "noreply@magenapilates.com"}>`,
          to:      customer_email,
          subject: `Invoice ${shortId} — Magena Pilates`,
          html:    buildInvoiceEmail({ order, shortId, amountPaid: emailAmount, isRental, isPending: true }),
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

    res.status(400).json({ error: 'Unsupported payment method or order type combination' });
  });

  // ── POST /api/orders/card/authorize ─────────────────────────────────────────
  // Called by frontend to submit PIN, OTP, or other challenge during card payment.
  // type: 'pin' | 'otp' | 'phone' | 'birthday'
  // value: the value to submit (PIN digits, OTP code, phone number, or YYYY-MM-DD date)
  router.post('/api/orders/card/authorize', async (req, res) => {
    const { reference, type, value } = req.body;
    if (!reference || !type || value === undefined || value === null || value === '') {
      return res.status(400).json({ error: 'reference, type, and value are required' });
    }

    try {
      let result;
      if      (type === 'pin')      result = await paystack.submitPin(reference, value);
      else if (type === 'otp')      result = await paystack.submitOtp(reference, value);
      else if (type === 'phone')    result = await paystack.submitPhone(reference, value);
      else if (type === 'birthday') result = await paystack.submitBirthday(reference, value);
      else return res.status(400).json({ error: 'Unsupported authorization type: ' + type });

      if (result.status === 'success') {
        return res.json({ success: true, reference, action: null });
      }

      if (result.status === 'failed') {
        return res.status(402).json({ error: result.display_text || 'Authorization failed.' });
      }

      // More steps needed
      return res.json({
        success:      true,
        reference,
        action:       result.status,
        url:          result.url || null,
        display_text: result.display_text || null,
      });

    } catch (err) {
      console.error('[Orders] Authorize error:', err.message);
      return res.status(502).json({ error: err.message || 'Authorization failed. Please try again.' });
    }
  });

  return router;
};
