const axios = require('axios');

const BASE_URL =
  process.env.PESAPAL_ENV?.trim().toLowerCase() === 'live'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';

let _cachedToken = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const { data } = await axios.post(
    `${BASE_URL}/api/Auth/RequestToken`,
    {
      consumer_key: process.env.PESAPAL_CONSUMER_KEY?.trim(),
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET?.trim(),
    },
    { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
  );

  if (!data.token) throw new Error('Pesapal auth failed: ' + JSON.stringify(data));

  _cachedToken = data.token;
  _tokenExpiry = Date.now() + 4 * 60 * 1000; // refresh before 5 min expiry
  return _cachedToken;
}

async function authHeaders() {
  const token = await getToken();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function getOrRegisterIPN(ipnUrl) {
  // If the IPN was pre-registered via Pesapal's dashboard, use it directly
  const presetId = process.env.PESAPAL_IPN_ID?.trim();
  if (presetId) return presetId;

  const headers = await authHeaders();

  try {
    const { data: list } = await axios.get(`${BASE_URL}/api/URLSetup/GetIpnList`, { headers });
    if (Array.isArray(list)) {
      const found = list.find((ipn) => ipn.url === ipnUrl && ipn.ipn_status === 1);
      if (found) return found.ipn_id;
    }
  } catch (_) {
    // Listing failed — fall through to register
  }

  const { data } = await axios.post(
    `${BASE_URL}/api/URLSetup/RegisterIPN`,
    { url: ipnUrl, ipn_notification_type: 'GET' },
    { headers }
  );

  if (!data.ipn_id)
    throw new Error('PesaPal IPN registration failed: ' + JSON.stringify(data));

  return data.ipn_id;
}

async function submitOrder({
  merchantReference,
  amount,
  currency = 'KES',
  description,
  callbackUrl,
  cancellationUrl,
  ipnId,
  billingAddress,
  paymentMethodType, // e.g. 'CARD' or 'MOBILE_MONEY' to skip method selection
}) {
  const headers = await authHeaders();

  const body = {
    id: merchantReference,
    currency,
    amount,
    description: String(description).slice(0, 100), // Pesapal max 100 chars
    callback_url: callbackUrl,
    cancellation_url: cancellationUrl,
    notification_id: ipnId,
    branch: 'Magena Pilates - Nairobi',
    billing_address: billingAddress,
  };

  if (paymentMethodType) {
    body.payment_method_type = paymentMethodType;
  }

  const { data } = await axios.post(
    `${BASE_URL}/api/Transactions/SubmitOrderRequest`,
    body,
    { headers }
  );

  if (!data.redirect_url)
    throw new Error('PesaPal order submission failed: ' + JSON.stringify(data));

  return data; // { redirect_url, order_tracking_id, merchant_reference }
}

// statusCode: 1=COMPLETED, 2=FAILED, 3=REVERSED, 0=INVALID/PENDING
async function getTransactionStatus(orderTrackingId) {
  const headers = await authHeaders();
  const { data } = await axios.get(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers }
  );
  return data;
}

module.exports = { getOrRegisterIPN, submitOrder, getTransactionStatus };
