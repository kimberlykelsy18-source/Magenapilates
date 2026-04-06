const express = require('express');
const flw = require('../services/flutterwave');

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
  //  PURCHASE  + card  →  Flutterwave v4 direct card API
  //                        Frontend sends card details → backend encrypts → charge
  //                        Returns: { charge_id, tx_ref, next_action }
  //
  //  RENTAL    + card  →  Flutterwave v3 payment plan + hosted checkout
  //                        Backend creates plan → gets hosted link → redirect customer
  //                        Returns: { redirect_url, tx_ref }
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

    const shortId  = toShortOrderId(order.order_number);
    const amountDue = Number(total_amount) + Number(deposit_amount || 0);

    // ── PURCHASE + CARD → Flutterwave v4 direct card API ────────────────────
    if (payment_method === 'card' && order_type === 'purchase') {
      if (!card?.number || !card?.expiry_month || !card?.expiry_year || !card?.cvv) {
        return res.status(400).json({ error: 'Card details are required for card payments' });
      }

      try {
        const customer = await flw.createCustomer({
          email: customer_email,
          name:  customer_name,
          phone: customer_phone,
        });

        const paymentMethod = await flw.createPaymentMethod({
          cardNumber:  card.number,
          expiryMonth: card.expiry_month,
          expiryYear:  card.expiry_year,
          cvv:         card.cvv,
        });

        const charge = await flw.createCharge({
          customerId:      customer.id,
          paymentMethodId: paymentMethod.id,
          txRef:           shortId,
          amount:          amountDue,
          currency:        'KES',
          redirectUrl:     `${process.env.FRONTEND_URL}/order-success`,
          description:     `Magena Pilates — ${product_name} (Purchase) ${shortId}`,
        });

        // Store charge ID in flw_plan_id column (reused for v4 charge ID lookup)
        await serviceSupabase.from('payments').insert({
          order_id:            order.id,
          checkout_request_id: shortId,
          amount:              amountDue,
          payment_method:      'card',
          status:              'pending',
          flw_plan_id:         charge.id, // v4 charge ID stored here for verification
        });

        if (charge.status === 'succeeded' || charge.status === 'successful') {
          return res.status(201).json({ order_id: order.id, short_id: shortId, charge_id: charge.id, tx_ref: shortId, next_action: null });
        }

        return res.status(201).json({
          order_id:    order.id,
          short_id:    shortId,
          charge_id:   charge.id,
          tx_ref:      shortId,
          next_action: charge.next_action || null,
        });

      } catch (err) {
        console.error('[Orders] v4 Purchase error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── RENTAL + CARD → Flutterwave v3 payment plan + hosted checkout ────────
    if (payment_method === 'card' && order_type === 'rental') {
      try {
        const rentalAmount  = Number(total_amount);  // monthly rental rate (without deposit)
        const fixedMonths   = 5;                     // from site_settings — 5-month fixed term
        const txRef         = `r-${order.id}`;       // unique tx_ref for this rental

        // Step 1: Create payment plan (v3)
        // duration=5 → 5 total charges: first checkout + 4 auto-monthly
        const plan = await flw.createPaymentPlan({
          name:     `${product_name} — Monthly Rental (${shortId})`,
          amount:   rentalAmount,
          duration: fixedMonths,
          currency: 'KES',
          interval: 'monthly',
        });

        // Step 2: Initiate hosted checkout with plan attached (v3)
        // amount = deposit + first month (charged now)
        // subsequent months auto-charged by Flutterwave at plan.amount
        const checkout = await flw.initiateHostedCheckout({
          txRef,
          amount:   amountDue,
          currency: 'KES',
          redirectUrl: `${process.env.FRONTEND_URL}/order-success`,
          customer: {
            email:       customer_email,
            name:        customer_name,
            phonenumber: customer_phone,
          },
          customizations: {
            title:       'Magena Pilates',
            description: `${product_name} — Monthly Rental ${shortId}`,
          },
          paymentPlanId: plan.id,
        });

        // Store tx_ref + plan ID
        await serviceSupabase.from('payments').insert({
          order_id:            order.id,
          checkout_request_id: txRef,
          amount:              amountDue,
          payment_method:      'card',
          status:              'pending',
          flw_plan_id:         String(plan.id), // v3 plan ID for subscription management
        });

        console.log(`[Orders] v3 Rental plan ${plan.id} created for ${shortId}`);

        return res.status(201).json({
          order_id:     order.id,
          short_id:     shortId,
          redirect_url: checkout.link,
          tx_ref:       txRef,
          plan_id:      plan.id,
        });

      } catch (err) {
        console.error('[Orders] v3 Rental error:', err.message);
        await serviceSupabase.from('pre_orders').update({ status: 'cancelled' }).eq('id', order.id);
        return res.status(502).json({ error: err.message || 'Payment gateway error. Please try again.' });
      }
    }

    // ── M-PESA — manual paybill flow ─────────────────────────────────────────
    if (payment_method === 'mpesa') {
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

  // ── PIN / OTP authorization (v4 purchase only) ───────────────────────────
  router.post('/api/orders/card/authorize', async (req, res) => {
    const { charge_id, authorization } = req.body;
    if (!charge_id || !authorization?.type) {
      return res.status(400).json({ error: 'charge_id and authorization type required' });
    }
    try {
      const charge = await flw.updateCharge(charge_id, authorization);
      if (charge.status === 'succeeded' || charge.status === 'successful') {
        return res.json({ success: true, charge_id, next_action: null });
      }
      return res.json({ success: true, charge_id, next_action: charge.next_action || null });
    } catch (err) {
      console.error('[Orders] Authorize error:', err.message);
      return res.status(502).json({ error: err.message || 'Authorization failed. Please try again.' });
    }
  });

  return router;
};
