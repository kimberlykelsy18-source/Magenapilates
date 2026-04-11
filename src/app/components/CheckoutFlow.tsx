import { useState } from 'react';
import { PreOrder } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, CreditCard, Smartphone, Lock, ExternalLink, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface CheckoutFlowProps {
  order: PreOrder;
  totalAmount: number;
  currency: string;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

type Stage = 'card-form' | 'pin' | 'otp' | 'phone' | 'birthday' | 'processing' | 'done';

function formatCardNumber(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

export function CheckoutFlow({ order, totalAmount, onCancel, onSuccess }: CheckoutFlowProps) {
  const [stage, setStage]     = useState<Stage>('card-form');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Card form state (v4 purchase only)
  const [cardNumber, setCardNumber]   = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear]   = useState('');
  const [cvv, setCvv]                 = useState('');

  // auth challenge state
  const [pendingReference, setPendingReference] = useState('');
  const [pinInput, setPinInput]       = useState('');
  const [otpInput, setOtpInput]       = useState('');
  const [phoneInput, setPhoneInput]   = useState('');
  const [birthdayInput, setBirthdayInput] = useState('');

  const isMpesa  = order.paymentMethod === 'mpesa';
  const isRental = order.orderType === 'rental';

  // ── Base order payload (shared by all paths) ─────────────────────────────
  function basePayload(extra?: object) {
    return {
      product_id:       order.productId,
      product_name:     order.productName,
      order_type:       order.orderType,
      quantity:         order.quantity,
      wants_engraving:  order.wantsEngraving,
      customer_name:    order.customerName,
      customer_email:   order.customerEmail,
      customer_phone:   order.customerPhone,
      customer_address: order.customerAddress,
      notes:            order.notes,
      total_amount:     order.totalAmount,
      deposit_amount:   order.depositAmount || 0,
      payment_method:   order.paymentMethod,
      ...extra,
    };
  }

  // ── M-PESA ────────────────────────────────────────────────────────────────
  const handleMpesa = async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload()),
      });
      if (!ok) throw new Error(data?.error || 'Failed to place order');
      setStage('done');
      onSuccess(data.order_id);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── RENTAL — Paystack hosted checkout (redirect) ─────────────────────────
  const handleRentalCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload()),
      });
      if (!ok) throw new Error(data?.error || 'Failed to initiate rental checkout');
      // Redirect to Paystack hosted checkout
      window.location.href = data.redirect_url;
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // ── PURCHASE — Paystack direct card API ──────────────────────────────────
  const handleCardSubmit = async () => {
    const rawNumber = cardNumber.replace(/\s/g, '');
    if (!rawNumber || rawNumber.length < 13) { setError('Please enter a valid card number.'); return; }
    if (!expiryMonth || !expiryYear)          { setError('Please enter the card expiry date.'); return; }
    if (!cvv || cvv.length < 3)               { setError('Please enter the 3–4 digit CVV.'); return; }

    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload({
          card: { number: rawNumber, expiry_month: expiryMonth, expiry_year: expiryYear, cvv },
        })),
      });

      if (!ok) throw new Error(data?.error || 'Card payment failed. Please try again.');

      setPendingReference(data.reference);

      const action = data.action; // 'send_pin' | 'send_otp' | 'open_url' | null
      if (!action) {
        setStage('done');
        onSuccess(data.order_id);
      } else if (action === 'open_url' && data.url) {
        window.location.href = data.url;
      } else if (action === 'send_pin') {
        setStage('pin');
      } else if (action === 'send_otp') {
        setStage('otp');
      } else if (action === 'send_phone') {
        setStage('phone');
      } else if (action === 'send_birthday') {
        setStage('birthday');
      } else {
        throw new Error(`Unsupported auth step: ${action}. Please try a different card.`);
      }
    } catch (err: any) {
      setError(err.message || 'Card payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  async function submitChallenge(type: string, value: string) {
    const { ok, data } = await apiFetch(`${API}/api/orders/card/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: pendingReference, type, value }),
    });
    if (!ok) throw new Error(data?.error || 'Authorization failed.');
    return data;
  }

  function handleNextAction(data: any) {
    const action = data.action;
    if (!action) { setStage('done'); onSuccess(pendingReference); return; }
    if (action === 'open_url' && data.url) { window.location.href = data.url; return; }
    if (action === 'send_pin')      { setStage('pin');      return; }
    if (action === 'send_otp')      { setStage('otp');      return; }
    if (action === 'send_phone')    { setStage('phone');    return; }
    if (action === 'send_birthday') { setStage('birthday'); return; }
    throw new Error('Payment could not be completed. Please try again.');
  }

  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length < 4) { setError('Please enter your 4-digit card PIN.'); return; }
    setLoading(true); setError('');
    try {
      const data = await submitChallenge('pin', pinInput);
      setPinInput('');
      handleNextAction(data);
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN. Please try again.');
    } finally { setLoading(false); }
  };

  const handleOtpSubmit = async () => {
    if (!otpInput || otpInput.length < 4) { setError('Please enter the OTP sent to your phone.'); return; }
    setLoading(true); setError('');
    try {
      const data = await submitChallenge('otp', otpInput);
      setOtpInput('');
      handleNextAction(data);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setStage('card-form');
    } finally { setLoading(false); }
  };

  const handlePhoneSubmit = async () => {
    if (!phoneInput) { setError('Please enter your phone number.'); return; }
    setLoading(true); setError('');
    try {
      const data = await submitChallenge('phone', phoneInput);
      setPhoneInput('');
      handleNextAction(data);
    } catch (err: any) {
      setError(err.message || 'Phone verification failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleBirthdaySubmit = async () => {
    if (!birthdayInput) { setError('Please enter your date of birth.'); return; }
    setLoading(true); setError('');
    try {
      const data = await submitChallenge('birthday', birthdayInput);
      setBirthdayInput('');
      handleNextAction(data);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Order summary strip (shared) ─────────────────────────────────────────
  const OrderSummary = () => (
    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
      <div className="flex justify-between"><span className="text-gray-500">Product</span><span>{order.productName} × {order.quantity}</span></div>
      <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-500">Total</span><span className="font-medium">KES {totalAmount.toLocaleString()}</span></div>
    </div>
  );

  // ── M-PESA UI ─────────────────────────────────────────────────────────────
  if (isMpesa) {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <h3 className="text-xl mb-1">M-PESA Payment</h3>
          <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3 p-4 rounded border bg-green-50 border-green-200">
          <Smartphone className="h-8 w-8 text-green-700 shrink-0" />
          <div>
            <h4 className="font-medium text-green-900">Pay via M-PESA Paybill</h4>
            <p className="text-sm text-green-700">We'll confirm your order within 24 hours after payment.</p>
          </div>
        </div>
        <OrderSummary />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleMpesa} disabled={loading} className="flex-1 text-white py-6 bg-green-600 hover:bg-green-700">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Placing Order...</> : <><Smartphone className="h-4 w-4 mr-2" />Place M-PESA Order</>}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── RENTAL — redirect to v3 hosted checkout ──────────────────────────────
  if (isRental) {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <h3 className="text-xl mb-1">Monthly Rental — Subscription</h3>
          <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">First payment (deposit + 1st month). Months 2–5 auto-charged monthly.</p>
        </div>
        <div className="flex items-center gap-3 p-4 rounded border bg-blue-50 border-blue-200">
          <CreditCard className="h-8 w-8 text-blue-700 shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">Secure Card Subscription</h4>
            <p className="text-sm text-blue-700">You'll be redirected to Paystack to enter your card details. Your card is enrolled for automatic monthly billing.</p>
          </div>
        </div>
        <OrderSummary />
        <div className="border p-3 text-xs rounded bg-blue-50 border-blue-200 text-blue-800">
          After entering your card on the secure checkout page, you'll be charged monthly automatically for 5 months. Subscription stops automatically after the 5th payment.
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleRentalCheckout} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting...</> : <><ExternalLink className="h-4 w-4 mr-2" />Proceed to Checkout</>}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Lock className="h-3 w-3" />
          <span>Secured by Paystack</span>
        </div>
      </div>
    );
  }

  // ── PURCHASE — v4 card form ───────────────────────────────────────────────
  if (stage === 'card-form') {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <h3 className="text-xl mb-1">Card Payment</h3>
          <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-[#3D3530]">Card Number</Label>
            <Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} inputMode="numeric" className="mt-1 font-mono tracking-wider" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[#3D3530]">Month</Label>
              <Input value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="MM" maxLength={2} inputMode="numeric" className="mt-1" />
            </div>
            <div>
              <Label className="text-[#3D3530]">Year</Label>
              <Input value={expiryYear} onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" maxLength={4} inputMode="numeric" className="mt-1" />
            </div>
            <div>
              <Label className="text-[#3D3530]">CVV</Label>
              <Input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" maxLength={4} inputMode="numeric" type="password" className="mt-1" />
            </div>
          </div>
        </div>
        <OrderSummary />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleCardSubmit} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <><CreditCard className="h-4 w-4 mr-2" />Pay Now</>}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Lock className="h-3 w-3" />
          <span>Secured by Paystack</span>
        </div>
      </div>
    );
  }

  // ── PIN ───────────────────────────────────────────────────────────────────
  if (stage === 'pin') {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <CreditCard className="h-10 w-10 mx-auto mb-3 text-[#3D3530]" />
          <h3 className="text-xl mb-1">Enter Card PIN</h3>
          <p className="text-sm text-gray-500">Your bank requires your card PIN to proceed.</p>
        </div>
        <div>
          <Label className="text-[#3D3530]">Card PIN</Label>
          <Input value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter PIN" type="password" inputMode="numeric" maxLength={6} className="mt-1 text-center tracking-widest text-lg" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handlePinSubmit} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</> : 'Submit PIN'}
          </Button>
          <Button onClick={() => { setStage('card-form'); setError(''); }} variant="outline" disabled={loading} className="px-6">Back</Button>
        </div>
      </div>
    );
  }

  // ── OTP ───────────────────────────────────────────────────────────────────
  if (stage === 'otp') {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <Smartphone className="h-10 w-10 mx-auto mb-3 text-[#3D3530]" />
          <h3 className="text-xl mb-1">Enter OTP</h3>
          <p className="text-sm text-gray-500">A one-time code has been sent to your registered number.</p>
        </div>
        <div>
          <Label className="text-[#3D3530]">OTP Code</Label>
          <Input value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Enter OTP" inputMode="numeric" maxLength={8} className="mt-1 text-center tracking-widest text-lg" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleOtpSubmit} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</> : 'Submit OTP'}
          </Button>
          <Button onClick={() => { setStage('card-form'); setError(''); }} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── Phone ─────────────────────────────────────────────────────────────────
  if (stage === 'phone') {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <Smartphone className="h-10 w-10 mx-auto mb-3 text-[#3D3530]" />
          <h3 className="text-xl mb-1">Enter Phone Number</h3>
          <p className="text-sm text-gray-500">Your bank requires your phone number to proceed.</p>
        </div>
        <div>
          <Label className="text-[#3D3530]">Phone Number</Label>
          <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="+254 7xx xxx xxx" inputMode="tel" className="mt-1" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handlePhoneSubmit} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</> : 'Submit'}
          </Button>
          <Button onClick={() => { setStage('card-form'); setError(''); }} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── Birthday ───────────────────────────────────────────────────────────────
  if (stage === 'birthday') {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <CreditCard className="h-10 w-10 mx-auto mb-3 text-[#3D3530]" />
          <h3 className="text-xl mb-1">Enter Date of Birth</h3>
          <p className="text-sm text-gray-500">Your bank requires your date of birth to verify your identity.</p>
        </div>
        <div>
          <Label className="text-[#3D3530]">Date of Birth</Label>
          <Input value={birthdayInput} onChange={(e) => setBirthdayInput(e.target.value)} placeholder="YYYY-MM-DD" className="mt-1" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleBirthdaySubmit} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</> : 'Submit'}
          </Button>
          <Button onClick={() => { setStage('card-form'); setError(''); }} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div className="text-center space-y-4 py-8">
      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
      <h3 className="text-xl text-[#3D3530]">Payment Successful!</h3>
      <p className="text-sm text-gray-500">Your order is confirmed. Check your email for details.</p>
    </div>
  );
}
