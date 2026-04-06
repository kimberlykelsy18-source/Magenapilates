const express = require('express');
const flw = require('../services/flutterwave');

// PRE-A001, PRE-B001, ...
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

  // Public — create pre-order + initiate Flutterwave V4 card payment
  // Flow: createCustomer → createPaymentMethod → createCharge → return next_action to frontend
  router.post('/api/orders', async (req, res) => {
    const {
      product_id, product_name, order_type, quantity, wants_engraving,
      customer_name, customer_email, customer_phone, customer_address,
      notes, total_amount, deposit_amount, payment_method,
      card, // { number, expiry_month, expiry_year, cvv } — only for card payments
    } = req.body;

    if (!product_id || !product_name || !order_type || !customer_name || !customer_email || !customer_phone || !total_amount || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert the pre-order
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

    const shortId = toShortOrderId(order.order_number);

    // ── Card payment — Flutterwave V4 direct API ──────────────────────────────
    if (payment_method === 'card') {
      if (!card?.number || !card?.expiry_month || !card?.expiry_year || !card?.cvv) {
        return res.status(400).json({ error: 'Card details are required for card payments' });
      }

      const amountDue = Number(total_amount) + Number(deposit_amount || 0);

      try {
        // Step 1: Create / fetch customer
        const customer = await flw.createCustomer({
          email: customer_email,
          name:  customer_name,
          phone: customer_phone,
        });

        // Step 2: Create encrypted payment method
        const paymentMethod = await flw.createPaymentMethod({
          cardNumber:  card.number,
          expiryMonth: card.expiry_month,
          expiryYear:  card.expiry_year,
          cvv:         card.cvv,
        });

        // Step 3: Create charge
        const charge = await flw.createCharge({
          customerId:      customer.id,
          paymentMethodId: paymentMethod.id,
          txRef:           shortId,
          amount:          amountDue,
          currency:        'KES',
          redirectUrl:     `${process.env.FRONTEND_URL}/order-success`,
          description:     `Magena Pilates — ${product_name} (${order_type}) ${shortId}`,
        });

        // Record payment entry — store charge ID in checkout_request_id
        await serviceSupabase.from('payments').insert({
          order_id:            order.id,
          checkout_request_id: shortId,       // used to look up on verify
          amount:              amountDue,
          payment_method:      'card',
          status:              'pending',
          flw_plan_id:         charge.id,     // reused field to store FLW charge ID
        });

        // Charge succeeded immediately (no auth required)
        if (charge.status === 'succeeded' || charge.status === 'successful') {
          return res.status(201).json({
            order_id:    order.id,
            short_id:    shortId,
            charge_id:   charge.id,
            tx_ref:      shortId,
            next_action: null,
          });
        }

        // Auth required (PIN / OTP / 3DS redirect)
        return res.status(201).json({
          order_id:    order.id,
          short_id:    shortId,
          charge_id:   charge.id,
          tx_ref:      shortId,
          next_action: charge.next_action || null,
        });

      } catch (err) {
        console.error('[Orders] Flutterwave error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── M-PESA — manual paybill flow ─────────────────────────────────────────
    if (payment_method === 'mpesa') {
      return res.status(201).json({
        order_id:      order.id,
        short_id:      shortId,
        payment_method: 'mpesa',
        mpesa_paybill: process.env.MPESA_PAYBILL || '',
        message:       'Order received. Please pay via M-PESA paybill using the order ID as account number.',
      });
    }

    res.status(400).json({ error: 'Unsupported payment method' });
  });

  // Public — authorize card charge (PIN / OTP step)
  router.post('/api/orders/card/authorize', async (req, res) => {
    const { charge_id, authorization } = req.body;

    if (!charge_id || !authorization?.type) {
      return res.status(400).json({ error: 'charge_id and authorization type are required' });
    }

    try {
      const charge = await flw.updateCharge(charge_id, authorization);

      if (charge.status === 'succeeded' || charge.status === 'successful') {
        return res.json({ success: true, charge_id, next_action: null });
      }

      return res.json({
        success:     true,
        charge_id,
        next_action: charge.next_action || null,
      });
    } catch (err) {
      console.error('[Orders] Authorize error:', err.message);
      return res.status(502).json({ error: err.message || 'Authorization failed. Please try again.' });
    }
  });

  return router;
};
