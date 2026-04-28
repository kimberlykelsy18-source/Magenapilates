const axios = require('axios');
const crypto = require('crypto');

// Paystack — hosted checkout + subscriptions
// Docs: https://paystack.com/docs/api
//
// Auth: Bearer {PAYSTACK_SECRET_KEY}
// Amounts: multiply KES by 100 (Paystack uses smallest currency unit)
//
// Purchase flow:
//   POST /transaction/initialize → get authorization_url → redirect customer
//   Paystack calls callback_url with ?reference=xxx after payment
//   GET  /transaction/verify/:reference → confirm final state
//
// Rental (subscription) flow:
//   POST /plan → get plan_code
//   POST /transaction/initialize (with plan) → get authorization_url → redirect customer
//   Webhook: charge.success confirms first + recurring payments

const BASE = 'https://api.paystack.co';

function headers() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error('[Paystack] PAYSTACK_SECRET_KEY is not set in .env');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function toKobo(amount) {
  return Math.round(Number(amount) * 100);
}

function makeReference(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// =============================================================================
// HOSTED CHECKOUT  (purchase and rental)
// =============================================================================

/**
 * Initialize a hosted checkout page.
 * Customer is redirected to authorization_url to complete payment.
 * For rentals, pass a plan code to enrol the customer in a subscription.
 * Returns { authorization_url, access_code, reference }.
 */
async function initializeTransaction({ email, amount, reference, plan, callback_url, metadata }) {
  const payload = { email, amount: toKobo(amount), reference, callback_url };
  if (plan)     payload.plan = plan;
  if (metadata) payload.metadata = metadata;

  try {
    const { data } = await axios.post(`${BASE}/transaction/initialize`, payload, { headers: headers() });
    if (!data.status) throw new Error('[Paystack] Init failed: ' + JSON.stringify(data));
    console.log('[Paystack] Transaction initialized:', data.data?.reference);
    return data.data; // { authorization_url, access_code, reference }
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] Init failed: ' + (errData?.message || err.message));
  }
}

/**
 * Verify a transaction by its reference.
 * Check data.status === 'success' for confirmation.
 */
async function verifyTransaction(reference) {
  try {
    const { data } = await axios.get(
      `${BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: headers() }
    );
    if (!data.status) throw new Error('[Paystack] Verify failed: ' + JSON.stringify(data));
    console.log('[Paystack] verifyTransaction:', data.data?.status, '| ref:', reference);
    return data.data; // { status: 'success'|'failed'|'abandoned', reference, ... }
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] Verify failed: ' + (errData?.message || err.message));
  }
}

// =============================================================================
// SUBSCRIPTION PLANS  (rental orders)
// =============================================================================

/**
 * Create a recurring subscription plan.
 * invoice_limit: total number of charges (0 = unlimited).
 */
async function createPlan({ name, amount, interval = 'monthly', invoice_limit = 5 }) {
  try {
    const { data } = await axios.post(`${BASE}/plan`, {
      name,
      amount: toKobo(amount),
      interval,
      invoice_limit,
    }, { headers: headers() });
    if (!data.status) throw new Error('[Paystack] Plan creation failed: ' + JSON.stringify(data));
    console.log('[Paystack] Plan created:', data.data.plan_code);
    return data.data; // { plan_code, id, name, amount, interval, invoice_limit, ... }
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] Plan creation failed: ' + (errData?.message || err.message));
  }
}

/**
 * Disable (cancel) a subscription by its code and email token.
 */
async function cancelSubscription(code, token) {
  try {
    const { data } = await axios.post(`${BASE}/subscription/disable`, { code, token }, { headers: headers() });
    return data;
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] Cancel subscription failed: ' + (errData?.message || err.message));
  }
}

/**
 * List subscriptions — optionally filter by customer email.
 */
async function listSubscriptions({ email } = {}) {
  const url = email
    ? `${BASE}/subscription?customer=${encodeURIComponent(email)}`
    : `${BASE}/subscription`;
  const { data } = await axios.get(url, { headers: headers() });
  return data.data || [];
}

// =============================================================================
// WEBHOOK VERIFICATION
// =============================================================================

/**
 * Verify a Paystack webhook request.
 * Paystack signs the raw body with HMAC-SHA512 using your secret key.
 * Compare against the x-paystack-signature header.
 */
function verifyWebhookSignature(rawBody, signature) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY?.trim() || '')
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

module.exports = {
  makeReference,
  initializeTransaction,
  verifyTransaction,
  createPlan,
  cancelSubscription,
  listSubscriptions,
  verifyWebhookSignature,
};
