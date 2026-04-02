const { createServiceClient } = require('../config/supabase');

const TIMEOUT_MINUTES = 30; // pre-orders get longer window than instant purchases
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // check every 10 minutes

async function runCleanup() {
  const db = createServiceClient();
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString();

  const { data: stalePayments, error } = await db
    .from('payments')
    .select('id, order_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff);

  if (error) {
    console.error('[PaymentCleanup] Query error:', error.message);
    return;
  }

  if (!stalePayments || stalePayments.length === 0) return;

  console.log(`[PaymentCleanup] ${stalePayments.length} timed-out payment(s) found`);

  const staleIds = stalePayments.map((p) => p.id);
  const orderIds = stalePayments.filter((p) => p.order_id).map((p) => p.order_id);

  await db
    .from('payments')
    .update({ status: 'failed', failure_reason: 'Payment session expired — no callback received' })
    .in('id', staleIds);

  if (orderIds.length > 0) {
    await db
      .from('pre_orders')
      .update({ status: 'failed' })
      .in('id', orderIds);

    console.log(`[PaymentCleanup] Marked ${orderIds.length} order(s) as failed`);
  }
}

function startPaymentCleanup() {
  console.log(
    `[PaymentCleanup] Started — checking every 10 min for payments pending > ${TIMEOUT_MINUTES} min`
  );
  setTimeout(runCleanup, 60 * 1000); // first run 1 min after boot
  setInterval(runCleanup, CHECK_INTERVAL_MS);
}

module.exports = { startPaymentCleanup };
