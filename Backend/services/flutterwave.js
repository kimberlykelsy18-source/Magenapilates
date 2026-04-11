
const axios  = require('axios');
const crypto = require('crypto');

// ── v4 — Purchase (one-time card payments) ────────────────────────────────────
// Auth: Keycloak OAuth2 → Bearer access token
// API:  https://developersandbox-api.flutterwave.com (sandbox)
//       https://api.flutterwave.com                  (production)

// ── v3 — Rental (subscriptions / payment plans) ───────────────────────────────
// Auth: Bearer {FLW_CLIENT_SECRET} directly (no OAuth needed)
// API:  https://api.flutterwave.com/v3

// =============================================================================
// V4 — AUTH
// =============================================================================

const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

function v4ApiBase() {
  return process.env.FLW_ENV === 'production'
    ? 'https://api.flutterwave.com'
    : 'https://developersandbox-api.flutterwave.com';
}

let _cachedToken = null;
let _tokenExpiry  = 0;

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const params = new URLSearchParams();
  params.append('grant_type',    'client_credentials');
  params.append('client_id',     process.env.FLW_CLIENT_ID);
  params.append('client_secret', process.env.FLW_CLIENT_SECRET);

  const { data } = await axios.post(TOKEN_URL, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!data.access_token) throw new Error('[FLW v4] Token fetch failed: ' + JSON.stringify(data));

  _cachedToken = data.access_token;
  _tokenExpiry  = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  console.log('[FLW v4] Token obtained');
  return _cachedToken;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function v4Headers(traceId) {
  const token = await getToken();
  return {
    Authorization:       `Bearer ${token}`,
    'Content-Type':      'application/json',
    'X-Trace-Id':        traceId ? makeId(traceId) : makeId('mgn'),
    'X-Idempotency-Key': makeId('ik'),
  };
}

// =============================================================================
// V4 — AES-256-GCM ENCRYPTION (for card details)
// =============================================================================

function generateNonce() {
  return crypto.randomBytes(6).toString('hex'); // 12 hex chars
}

function encryptField(value, nonce) {
  const encKey = process.env.FLW_ENCRYPTION_KEY;
  if (!encKey) throw new Error('[FLW v4] FLW_ENCRYPTION_KEY is not set');
  const key       = Buffer.from(encKey, 'base64');
  const iv        = Buffer.from(nonce, 'utf8');
  const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString('base64');
}

// =============================================================================
// V4 — DIRECT CARD API  (used for PURCHASE orders)
// =============================================================================

async function createCustomer({ email, name, phone }) {
  const parts     = (name || '').trim().split(/\s+/);
  const firstName = parts[0] || email;
  const lastName  = parts.slice(1).join(' ') || parts[0] || email;
  const phoneDigits = (phone || '').replace(/\D/g, '').replace(/^(254|0)/, '');

  const payload = { email, name: { first: firstName, last: lastName } };
  if (phoneDigits) payload.phone = { country_code: '254', number: phoneDigits };

  const headers = await v4Headers(`cus-${Date.now()}`);

  try {
    const { data } = await axios.post(`${v4ApiBase()}/customers`, payload, { headers });
    if (!data.data?.id) throw new Error('[FLW v4] Customer create failed: ' + JSON.stringify(data));
    console.log('[FLW v4] Customer created:', data.data.id);
    return data.data;
  } catch (err) {
    const code = err.response?.data?.error?.code;
    if (code === '10409') {
      console.log('[FLW v4] Customer exists, fetching:', email);
      return await getCustomerByEmail(email);
    }
    const errData = err.response?.data;
    console.error('[FLW v4] Customer error:', JSON.stringify(errData, null, 2));
    throw new Error('[FLW v4] Customer create failed: ' + JSON.stringify(errData));
  }
}

async function getCustomerByEmail(email) {
  const headers = await v4Headers(`cus-get-${Date.now()}`);
  const { data } = await axios.get(
    `${v4ApiBase()}/customers?email=${encodeURIComponent(email)}`,
    { headers }
  );
  const customer = Array.isArray(data.data) ? data.data[0] : data.data;
  if (!customer?.id) throw new Error('[FLW v4] Customer not found: ' + email);
  return customer;
}

async function createPaymentMethod({ cardNumber, expiryMonth, expiryYear, cvv }) {
  const nonce   = generateNonce();
  const headers = await v4Headers(`pmd-${Date.now()}`);
  const month   = String(expiryMonth).padStart(2, '0').slice(-2);
  const year    = String(expiryYear).slice(-2);

  const payload = {
    type: 'card',
    card: {
      encrypted_card_number:  encryptField(cardNumber.replace(/\s/g, ''), nonce),
      encrypted_expiry_month: encryptField(month, nonce),
      encrypted_expiry_year:  encryptField(year, nonce),
      encrypted_cvv:          encryptField(cvv, nonce),
      nonce,
    },
  };

  console.log('[FLW v4] createPaymentMethod — expiry:', month + '/' + year);

  try {
    const { data } = await axios.post(`${v4ApiBase()}/payment-methods`, payload, { headers });
    if (!data.data?.id) throw new Error('[FLW v4] Payment method failed: ' + JSON.stringify(data));
    console.log('[FLW v4] Payment method:', data.data.id);
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    console.error('[FLW v4] Payment method error:', JSON.stringify(errData, null, 2));
    throw new Error('[FLW v4] Payment method failed: ' + JSON.stringify(errData));
  }
}

async function createCharge({ customerId, paymentMethodId, txRef, amount, currency, redirectUrl, description }) {
  const headers = await v4Headers(txRef);
  const ref = txRef.length >= 6 ? txRef.slice(0, 42) : txRef.padEnd(6, '0');

  try {
    const { data } = await axios.post(`${v4ApiBase()}/charges`, {
      reference:         ref,
      currency:          currency || 'KES',
      amount,
      customer_id:       customerId,
      payment_method_id: paymentMethodId,
      redirect_url:      redirectUrl,
      meta:              description ? { description } : {},
    }, { headers });

    if (!data.data) throw new Error('[FLW v4] Charge failed: ' + JSON.stringify(data));
    console.log('[FLW v4] Charge:', data.data.id, '| next_action:', data.data.next_action?.type || 'none');
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    console.error('[FLW v4] Charge error:', JSON.stringify(errData, null, 2));
    throw new Error('[FLW v4] Charge failed: ' + JSON.stringify(errData));
  }
}

async function updateCharge(chargeId, authorization) {
  const headers = await v4Headers(`auth-${chargeId}`);

  let auth = authorization;
  if (authorization.type === 'pin' && authorization.pin?.rawPin) {
    const nonce = generateNonce();
    auth = {
      type: 'pin',
      pin: { nonce, encrypted_pin: encryptField(authorization.pin.rawPin, nonce) },
    };
  }

  const { data } = await axios.put(
    `${v4ApiBase()}/charges/${chargeId}`,
    { authorization: auth },
    { headers }
  );

  if (!data.data) throw new Error('[FLW v4] Charge update failed: ' + JSON.stringify(data));
  console.log('[FLW v4] Charge updated:', chargeId, '| next_action:', data.data.next_action?.type || 'none');
  return data.data;
}

async function getCharge(chargeId) {
  const headers = await v4Headers(`get-${chargeId}`);
  const { data } = await axios.get(`${v4ApiBase()}/charges/${chargeId}`, { headers });
  if (!data.data) throw new Error('[FLW v4] Get charge failed: ' + JSON.stringify(data));
  return data.data;
}

// =============================================================================
// V3 — HOSTED CHECKOUT + PAYMENT PLANS  (used for RENTAL / SUBSCRIPTION orders)
// =============================================================================

const V3_BASE = 'https://api.flutterwave.com/v3';

// v3 uses a separate secret key as Bearer (NOT the v4 OAuth token).
// Get it from: Flutterwave Dashboard > Settings > API Keys > Secret key
// Add it to .env as FLW_SECRET_KEY (looks like FLWSECK_TEST-xxxxxxxxxx)
function v3Headers() {
  const key = process.env.FLW_SECRET_KEY?.trim();
  if (!key || key === 'PASTE_YOUR_V3_SECRET_KEY_HERE')
    throw new Error('[FLW v3] FLW_SECRET_KEY is not set in .env — add your Flutterwave v3 Secret Key');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

/**
 * Create a recurring payment plan.
 * duration: total billing cycles including the first checkout payment.
 *   e.g. duration=5 → customer is charged 5 times total (1 now + 4 auto-monthly)
 */
async function createPaymentPlan({ name, amount, duration, currency = 'KES', interval = 'monthly' }) {
  const { data } = await axios.post(
    `${V3_BASE}/payment-plans`,
    { name, amount, currency, interval, duration },
    { headers: v3Headers() }
  );
  if (data.status !== 'success') throw new Error('[FLW v3] Plan creation failed: ' + JSON.stringify(data));
  console.log('[FLW v3] Payment plan created:', data.data.id);
  return data.data; // { id, plan_token, name, amount, interval, duration, ... }
}

/**
 * Initiate a hosted checkout page (customer is redirected here).
 * Attaching payment_plan restricts checkout to card-only and auto-enrols for monthly billing.
 * Returns { link } — redirect the customer to this URL.
 */
async function initiateHostedCheckout({ txRef, amount, currency = 'KES', redirectUrl, customer, customizations, paymentPlanId }) {
  const payload = {
    tx_ref: txRef,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer,       // { email, name, phonenumber }
    customizations, // { title, description, logo }
  };
  if (paymentPlanId) payload.payment_plan = paymentPlanId;

  const { data } = await axios.post(`${V3_BASE}/payments`, payload, { headers: v3Headers() });
  if (data.status !== 'success') throw new Error('[FLW v3] Hosted checkout failed: ' + JSON.stringify(data));
  console.log('[FLW v3] Hosted checkout link obtained');
  return data.data; // { link }
}

/**
 * Verify a v3 transaction by its numeric ID (appended to redirect_url as ?transaction_id=).
 */
async function verifyTransaction(transactionId) {
  const { data } = await axios.get(
    `${V3_BASE}/transactions/${transactionId}/verify`,
    { headers: v3Headers() }
  );
  if (data.status !== 'success') throw new Error('[FLW v3] Verify failed: ' + JSON.stringify(data));
  return data.data;
}

/**
 * Cancel all subscriptions under a plan (affects all customers on this plan).
 */
async function cancelPaymentPlan(planId) {
  const { data } = await axios.put(`${V3_BASE}/payment-plans/${planId}/cancel`, {}, { headers: v3Headers() });
  return data;
}

/**
 * List subscriptions — optionally filter by email to find a subscription ID.
 */
async function listSubscriptions({ email } = {}) {
  const url = email
    ? `${V3_BASE}/subscriptions?email=${encodeURIComponent(email)}`
    : `${V3_BASE}/subscriptions`;
  const { data } = await axios.get(url, { headers: v3Headers() });
  if (data.status !== 'success') throw new Error('[FLW v3] listSubscriptions failed: ' + JSON.stringify(data));
  return data.data;
}

/**
 * Cancel a single customer's subscription by subscription ID.
 * Get the ID first via listSubscriptions({ email }).
 */
async function cancelCustomerSubscription(subscriptionId) {
  const { data } = await axios.put(`${V3_BASE}/subscriptions/${subscriptionId}/cancel`, {}, { headers: v3Headers() });
  return data;
}

module.exports = {
  // v4 — purchase (direct card API)
  createCustomer,
  createPaymentMethod,
  createCharge,
  updateCharge,
  getCharge,
  // v3 — rental (hosted checkout + subscriptions)
  createPaymentPlan,
  initiateHostedCheckout,
  verifyTransaction,
  cancelPaymentPlan,
  listSubscriptions,
  cancelCustomerSubscription,
};
