const axios = require('axios');
const crypto = require('crypto');

// Paystack API — direct card charging + subscriptions
// Docs: https://paystack.com/docs/api
//
// Auth: Bearer {PAYSTACK_SECRET_KEY} (from dashboard > Settings > API Keys)
// Amounts: KES values must be multiplied by 100 (smallest currency unit / cents)
//
// Direct card charge flow:
//   POST /charge → status 'send_pin' | 'send_otp' | 'open_url' | 'success' | 'failed'
//   POST /charge/submit_pin  → next status
//   POST /charge/submit_otp  → next status
//   GET  /transaction/verify/:reference → confirm final state
//
// Subscription (rental) flow:
//   POST /plan → get plan_code
//   POST /transaction/initialize (with plan) → get authorization_url
//   Customer redirected → completes payment on Paystack-hosted page
//   Webhook: charge.success confirms payment

const BASE = 'https://api.paystack.co';

function headers() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error('[Paystack] PAYSTACK_SECRET_KEY is not set in .env');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

// KES → kobo (Paystack smallest unit: 100 per KES)
function toKobo(amount) {
  return Math.round(Number(amount) * 100);
}

function makeReference(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// =============================================================================
// DIRECT CARD CHARGE  (used for PURCHASE orders)
// =============================================================================

/**
 * Initiate a direct card charge.
 * Returns the charge data object with a `status` field:
 *   'success'       → payment done, no further action needed
 *   'send_pin'      → ask customer for their card PIN
 *   'send_otp'      → ask customer for OTP sent to their phone
 *   'open_url'      → redirect customer to data.url for 3DS authentication
 *   'send_phone'    → ask customer for phone number (rare)
 *   'send_birthday' → ask customer for date of birth (rare)
 *   'failed'        → payment rejected
 */
async function chargeCard({ email, amount, card, reference }) {
  const payload = {
    email,
    amount: toKobo(amount),
    reference,
    card: {
      number:        card.number.replace(/\s/g, ''),
      cvv:           card.cvv,
      expiry_month:  String(card.expiry_month).padStart(2, '0').slice(-2),
      expiry_year:   String(card.expiry_year).slice(-2),
    },
  };

  try {
    const { data } = await axios.post(`${BASE}/charge`, payload, { headers: headers() });
    console.log('[Paystack] chargeCard status:', data.data?.status, '| ref:', reference);
    return data.data; // { status, reference, display_text, url?, ... }
  } catch (err) {
    const errData = err.response?.data;
    console.error('[Paystack] chargeCard error:', JSON.stringify(errData, null, 2));
    throw new Error('[Paystack] Charge failed: ' + (errData?.message || err.message));
  }
}

/**
 * Submit card PIN (called after status === 'send_pin').
 */
async function submitPin(reference, pin) {
  try {
    const { data } = await axios.post(`${BASE}/charge/submit_pin`, { pin, reference }, { headers: headers() });
    console.log('[Paystack] submitPin status:', data.data?.status, '| ref:', reference);
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] PIN failed: ' + (errData?.message || err.message));
  }
}

/**
 * Submit OTP (called after status === 'send_otp').
 */
async function submitOtp(reference, otp) {
  try {
    const { data } = await axios.post(`${BASE}/charge/submit_otp`, { otp, reference }, { headers: headers() });
    console.log('[Paystack] submitOtp status:', data.data?.status, '| ref:', reference);
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] OTP failed: ' + (errData?.message || err.message));
  }
}

/**
 * Submit phone number (called after status === 'send_phone').
 */
async function submitPhone(reference, phone) {
  try {
    const { data } = await axios.post(`${BASE}/charge/submit_phone`, { phone, reference }, { headers: headers() });
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] Phone submit failed: ' + (errData?.message || err.message));
  }
}

/**
 * Submit birthday (called after status === 'send_birthday').
 * birthday format: YYYY-MM-DD
 */
async function submitBirthday(reference, birthday) {
  try {
    const { data } = await axios.post(`${BASE}/charge/submit_birthday`, { birthday, reference }, { headers: headers() });
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    throw new Error('[Paystack] Birthday submit failed: ' + (errData?.message || err.message));
  }
}

/**
 * Verify a transaction by its reference.
 * Returns the full transaction object. Check data.status === 'success' for confirmation.
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
// SUBSCRIPTION PLANS  (used for RENTAL orders)
// =============================================================================

/**
 * Create a recurring plan.
 * invoice_limit: max number of charges. 0 = unlimited. 5 = 5 months then auto-stops.
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
 * Initialize a hosted checkout page.
 * When plan is provided, customer is enrolled in the subscription on payment.
 * Returns { authorization_url, access_code, reference } — redirect to authorization_url.
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
 * Disable (cancel) a subscription.
 * code: subscription code (e.g. SUB_vsyqdmlwanhe3su)
 * token: email token sent in the subscription webhook event
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
 * Paystack signs the raw request body with HMAC-SHA512 using your secret key.
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
  chargeCard,
  submitPin,
  submitOtp,
  submitPhone,
  submitBirthday,
  verifyTransaction,
  createPlan,
  initializeTransaction,
  cancelSubscription,
  listSubscriptions,
  verifyWebhookSignature,
};
