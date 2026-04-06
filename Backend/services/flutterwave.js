const axios  = require('axios');
const crypto = require('crypto');

// Flutterwave V4 — Keycloak OAuth2 + direct card API
// Sandbox: https://developersandbox-api.flutterwave.com
// Production: https://api.flutterwave.com

const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

function apiBase() {
  return process.env.FLW_ENV === 'production'
    ? 'https://api.flutterwave.com'
    : 'https://developersandbox-api.flutterwave.com';
}

// ── Token cache ──────────────────────────────────────────────────────────────
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

  if (!data.access_token) throw new Error('[FLW] Token fetch failed: ' + JSON.stringify(data));

  _cachedToken = data.access_token;
  _tokenExpiry  = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  console.log('[FLW] Token obtained');
  return _cachedToken;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function authHeaders(traceId) {
  const token  = await getToken();
  const xTrace = traceId ? makeId(traceId) : makeId('mgn');
  const xIdem  = makeId('ik');
  return {
    Authorization:       `Bearer ${token}`,
    'Content-Type':      'application/json',
    'X-Trace-Id':        xTrace,
    'X-Idempotency-Key': xIdem,
  };
}

// ── AES-256-GCM Encryption ───────────────────────────────────────────────────
// Key = Base64-decoded FLW_ENCRYPTION_KEY (from Flutterwave dashboard Settings → API Keys)
// IV  = 12-byte nonce (hex string)

function generateNonce() {
  return crypto.randomBytes(6).toString('hex'); // 12 hex chars = 12 bytes
}

function encryptField(value, nonce) {
  const encKey = process.env.FLW_ENCRYPTION_KEY;
  if (!encKey) throw new Error('[FLW] FLW_ENCRYPTION_KEY is not set');
  const key       = Buffer.from(encKey, 'base64');
  const iv        = Buffer.from(nonce, 'utf8');
  const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString('base64');
}

// ── Step 1: Create customer ──────────────────────────────────────────────────
async function createCustomer({ email, name, phone }) {
  const parts     = (name || '').trim().split(/\s+/);
  const firstName = parts[0] || email;
  const lastName  = parts.slice(1).join(' ') || parts[0] || email;
  const phoneDigits = (phone || '').replace(/\D/g, '').replace(/^(254|0)/, '');

  const payload = { email, name: { first: firstName, last: lastName } };
  if (phoneDigits) payload.phone = { country_code: '254', number: phoneDigits };

  const headers = await authHeaders(`cus-${Date.now()}`);

  try {
    const { data } = await axios.post(`${apiBase()}/customers`, payload, { headers });
    if (!data.data?.id) throw new Error('[FLW] Customer create failed: ' + JSON.stringify(data));
    console.log('[FLW] Customer created:', data.data.id);
    return data.data;
  } catch (err) {
    const code = err.response?.data?.error?.code;
    if (code === '10409') {
      console.log('[FLW] Customer already exists, fetching by email:', email);
      return await getCustomerByEmail(email);
    }
    const errData = err.response?.data;
    console.error('[FLW] Customer error:', JSON.stringify(errData, null, 2));
    throw new Error('[FLW] Customer create failed: ' + JSON.stringify(errData));
  }
}

async function getCustomerByEmail(email) {
  const headers = await authHeaders(`cus-get-${Date.now()}`);
  const { data } = await axios.get(
    `${apiBase()}/customers?email=${encodeURIComponent(email)}`,
    { headers }
  );
  const customer = Array.isArray(data.data) ? data.data[0] : data.data;
  if (!customer?.id) throw new Error('[FLW] Existing customer not found for email: ' + email);
  console.log('[FLW] Existing customer found:', customer.id);
  return customer;
}

// ── Step 2: Create payment method (encrypted card) ───────────────────────────
async function createPaymentMethod({ cardNumber, expiryMonth, expiryYear, cvv }) {
  const nonce   = generateNonce();
  const headers = await authHeaders(`pmd-${Date.now()}`);

  const month = String(expiryMonth).padStart(2, '0').slice(-2);
  const year  = String(expiryYear).slice(-2);

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

  console.log('[FLW] createPaymentMethod — expiry:', month + '/' + year);

  try {
    const { data } = await axios.post(`${apiBase()}/payment-methods`, payload, { headers });
    if (!data.data?.id) throw new Error('[FLW] Payment method create failed: ' + JSON.stringify(data));
    console.log('[FLW] Payment method:', data.data.id);
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    console.error('[FLW] Payment method error:', JSON.stringify(errData, null, 2));
    throw new Error('[FLW] Payment method create failed: ' + JSON.stringify(errData));
  }
}

// ── Step 3: Create charge ────────────────────────────────────────────────────
async function createCharge({ customerId, paymentMethodId, txRef, amount, currency, redirectUrl, description }) {
  const headers = await authHeaders(txRef);
  const ref = txRef.length >= 6 ? txRef.slice(0, 42) : txRef.padEnd(6, '0');

  try {
    const { data } = await axios.post(`${apiBase()}/charges`, {
      reference:         ref,
      currency:          currency || 'KES',
      amount,
      customer_id:       customerId,
      payment_method_id: paymentMethodId,
      redirect_url:      redirectUrl,
      meta:              description ? { description } : {},
    }, { headers });

    if (!data.data) throw new Error('[FLW] Charge create failed: ' + JSON.stringify(data));
    console.log('[FLW] Charge:', data.data.id, '| next_action:', data.data.next_action?.type || 'none');
    return data.data;
  } catch (err) {
    const errData = err.response?.data;
    console.error('[FLW] Charge error:', JSON.stringify(errData, null, 2));
    throw new Error('[FLW] Charge create failed: ' + JSON.stringify(errData));
  }
}

// ── Step 4: Authorize charge (PIN / OTP / AVS) ───────────────────────────────
async function updateCharge(chargeId, authorization) {
  const headers = await authHeaders(`auth-${chargeId}-${Date.now()}`);

  // Encrypt PIN before sending
  let auth = authorization;
  if (authorization.type === 'pin' && authorization.pin?.rawPin) {
    const nonce = generateNonce();
    auth = {
      type: 'pin',
      pin: { nonce, encrypted_pin: encryptField(authorization.pin.rawPin, nonce) },
    };
  }

  const { data } = await axios.put(
    `${apiBase()}/charges/${chargeId}`,
    { authorization: auth },
    { headers }
  );

  if (!data.data) throw new Error('[FLW] Charge update failed: ' + JSON.stringify(data));
  console.log('[FLW] Charge updated:', chargeId, '| next_action:', data.data.next_action?.type || 'none');
  return data.data;
}

// ── Get charge (verify status) ───────────────────────────────────────────────
async function getCharge(chargeId) {
  const headers = await authHeaders(`get-${chargeId}`);
  const { data } = await axios.get(`${apiBase()}/charges/${chargeId}`, { headers });
  if (!data.data) throw new Error('[FLW] Get charge failed: ' + JSON.stringify(data));
  return data.data;
}

module.exports = { createCustomer, createPaymentMethod, createCharge, updateCharge, getCharge };
