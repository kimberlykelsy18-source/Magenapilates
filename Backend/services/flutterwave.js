const axios = require('axios');

// ── Two API versions, two auth styles ────────────────────────────────────────
//
//  v4  — one-time card payments (hosted checkout)
//        Auth: OAuth 2.0 client credentials → Bearer access token
//        Base: https://api.flutterwave.com/v4
//
//  v3  — payment plans & subscriptions (recurring billing)
//        Auth: Bearer {FLW_CLIENT_SECRET} directly (the v3 secret key)
//        Base: https://api.flutterwave.com/v3

const V4_BASE = 'https://api.flutterwave.com/v4';
const V3_BASE = 'https://api.flutterwave.com/v3';

// ── v4 OAuth token cache ──────────────────────────────────────────────────────

let _v4Token = null;
let _v4TokenExpiry = 0;

async function getV4AccessToken() {
  if (_v4Token && Date.now() < _v4TokenExpiry) return _v4Token;

  const { data } = await axios.post(
    'https://api.flutterwave.com/oauth/token',
    {
      client_id: process.env.FLW_CLIENT_ID?.trim(),
      client_secret: process.env.FLW_CLIENT_SECRET?.trim(),
      grant_type: 'client_credentials',
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!data.access_token)
    throw new Error('Flutterwave v4 OAuth failed: ' + JSON.stringify(data));

  _v4Token = data.access_token;
  _v4TokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _v4Token;
}

async function v4Headers() {
  const token = await getV4AccessToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── v3 headers — secret key used directly as Bearer ──────────────────────────

function v3Headers() {
  const key = process.env.FLW_CLIENT_SECRET?.trim();
  if (!key) throw new Error('FLW_CLIENT_SECRET is not set');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// ── v4: One-time Card Payments (purchase + first rental payment) ──────────────

/**
 * Initiate a Flutterwave v4 hosted checkout.
 * For rental orders, pass paymentPlanId so the card is tokenised for future charges.
 * Returns { link } — redirect the customer to this URL.
 */
async function initiatePayment({
  txRef,
  amount,
  currency = 'KES',
  redirectUrl,
  customer,         // { email, name, phonenumber }
  customizations,   // { title, description, logo }
  paymentPlanId,    // optional — set for rental to attach the v3 plan
}) {
  const payload = {
    tx_ref: txRef,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer,
    customizations,
  };

  if (paymentPlanId) payload.payment_plan = paymentPlanId;

  const { data } = await axios.post(`${V4_BASE}/payments`, payload, {
    headers: await v4Headers(),
  });

  if (data.status !== 'success')
    throw new Error('Flutterwave v4 payment initiation failed: ' + JSON.stringify(data));

  return data.data; // { link }
}

// ── v4: Transaction Verification ─────────────────────────────────────────────

/**
 * Verify a transaction by its numeric ID (appended to redirect_url as ?transaction_id=).
 * Always verify server-side — never trust the client-reported status.
 */
async function verifyTransaction(transactionId) {
  const { data } = await axios.get(
    `${V4_BASE}/transactions/${transactionId}/verify`,
    { headers: await v4Headers() }
  );

  if (data.status !== 'success')
    throw new Error('Flutterwave v4 verify failed: ' + JSON.stringify(data));

  return data.data; // full transaction object
}

// ── v3: Payment Plans (Monthly Rental Subscriptions) ─────────────────────────
//
// HOW IT WORKS:
//   1. Create a v3 payment plan (amount = monthly rental only, duration = 5 months).
//   2. Pass plan ID when initiating the v4 checkout.
//      → Flutterwave restricts the checkout to card-only and tokenises the card.
//      → First charge = deposit + first month (the payload amount), processed now.
//   3. Flutterwave auto-charges the plan amount each month for months 2–5.
//   4. Each auto-charge fires a "charge.completed" webhook (success or failed).
//   5. After duration=5 charges total (incl. first), the plan stops automatically.

/**
 * Create a recurring payment plan via v3.
 *
 * @param {string} opts.name       e.g. "Reformer Rental — Monthly (PRE-A001)"
 * @param {number} opts.amount     Monthly rental rate in KES (NOT the deposit)
 * @param {number} opts.duration   Total billing cycles incl. first payment (5 = 5 months)
 * @param {string} [opts.currency] Default "KES"
 * @param {string} [opts.interval] Default "monthly"
 *
 * Returns { id, plan_token, name, amount, interval, duration, status, ... }
 */
async function createPaymentPlan({ name, amount, duration, currency = 'KES', interval = 'monthly' }) {
  const { data } = await axios.post(
    `${V3_BASE}/payment-plans`,
    { name, amount, currency, interval, duration },
    { headers: v3Headers() }
  );

  if (data.status !== 'success')
    throw new Error('Flutterwave v3 plan creation failed: ' + JSON.stringify(data));

  return data.data;
}

/**
 * Fetch a payment plan by ID (v3).
 */
async function getPaymentPlan(planId) {
  const { data } = await axios.get(`${V3_BASE}/payment-plans/${planId}`, { headers: v3Headers() });
  if (data.status !== 'success') throw new Error('getPaymentPlan failed: ' + JSON.stringify(data));
  return data.data;
}

/**
 * Cancel ALL subscriptions under a plan (affects every customer on this plan).
 * Use cancelCustomerSubscription() to cancel for a single customer only.
 */
async function cancelPaymentPlan(planId) {
  const { data } = await axios.put(
    `${V3_BASE}/payment-plans/${planId}/cancel`,
    {},
    { headers: v3Headers() }
  );
  return data;
}

/**
 * List subscriptions — filter by email to find a specific customer's subscription ID.
 */
async function listSubscriptions({ email } = {}) {
  const url = email
    ? `${V3_BASE}/subscriptions?email=${encodeURIComponent(email)}`
    : `${V3_BASE}/subscriptions`;
  const { data } = await axios.get(url, { headers: v3Headers() });
  if (data.status !== 'success') throw new Error('listSubscriptions failed: ' + JSON.stringify(data));
  return data.data;
}

/**
 * Cancel a single customer's subscription by subscription ID.
 * Get the ID first: listSubscriptions({ email }) → find matching plan → subscription.id
 * Fires "subscription.cancelled" webhook on success.
 */
async function cancelCustomerSubscription(subscriptionId) {
  const { data } = await axios.put(
    `${V3_BASE}/subscriptions/${subscriptionId}/cancel`,
    {},
    { headers: v3Headers() }
  );
  return data;
}

/**
 * Reactivate a previously cancelled subscription.
 */
async function activateCustomerSubscription(subscriptionId) {
  const { data } = await axios.put(
    `${V3_BASE}/subscriptions/${subscriptionId}/activate`,
    {},
    { headers: v3Headers() }
  );
  return data;
}

module.exports = {
  initiatePayment,
  verifyTransaction,
  createPaymentPlan,
  getPaymentPlan,
  cancelPaymentPlan,
  listSubscriptions,
  cancelCustomerSubscription,
  activateCustomerSubscription,
};
