const express = require('express');
const pesapal = require('../services/pesapal');

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

  // Public — get order by ID (used on order-success page)
  // Must use serviceSupabase: pre_orders is locked to service role by RLS
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

  // Public — create pre-order and initiate Pesapal payment
  router.post('/api/orders', async (req, res) => {
    const {
      product_id,
      product_name,
      order_type,
      quantity,
      wants_engraving,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      notes,
      total_amount,
      deposit_amount,
      payment_method,
    } = req.body;

    // Basic validation
    if (!product_id || !product_name || !order_type || !customer_name || !customer_email || !customer_phone || !total_amount || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert the pre-order
    const { data: order, error: orderError } = await serviceSupabase
      .from('pre_orders')
      .insert({
        product_id,
        product_name,
        order_type,
        quantity: quantity || 1,
        wants_engraving: wants_engraving || false,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        notes,
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

    // Both card and M-PESA go through Pesapal's hosted checkout.
    // Pesapal's checkout page handles card entry and M-PESA paybill display automatically.
    if (payment_method === 'card' || payment_method === 'mpesa') {
      try {
        const ipnUrl = `${process.env.BACKEND_URL}/pesapal/ipn`;
        const ipnId = await pesapal.getOrRegisterIPN(ipnUrl);

        const amountDue = Number(total_amount) + Number(deposit_amount || 0);

        const pesapalResult = await pesapal.submitOrder({
          merchantReference: order.id,
          amount: amountDue,
          currency: 'KES',
          description: `Magena Pilates — ${product_name} (${order_type})`,
          callbackUrl: `${process.env.FRONTEND_URL}/order-success`,
          cancellationUrl: `${process.env.FRONTEND_URL}/order-cancelled`,
          ipnId,
          billingAddress: {
            email_address: customer_email,
            phone_number: customer_phone,
            first_name: customer_name.split(' ')[0],
            last_name: customer_name.split(' ').slice(1).join(' ') || '',
            line_1: customer_address || '',
            city: '',
            country_code: 'KE',
          },
        });

        // Record payment entry
        await serviceSupabase.from('payments').insert({
          order_id: order.id,
          checkout_request_id: pesapalResult.order_tracking_id,
          amount: amountDue,
          payment_method,
          status: 'pending',
        });

        return res.status(201).json({
          order_id: order.id,
          short_id: shortId,
          redirect_url: pesapalResult.redirect_url,
          order_tracking_id: pesapalResult.order_tracking_id,
        });
      } catch (err) {
        console.error('[Orders] Pesapal error:', err.message);
        // Cancel the order if Pesapal fails
        await serviceSupabase
          .from('pre_orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);
        return res.status(502).json({ error: 'Payment gateway error. Please try again.' });
      }
    }

    res.status(400).json({ error: 'Unsupported payment method' });
  });

  return router;
};
