import { useState } from 'react';
import { PreOrder } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, CreditCard, Smartphone, Lock, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface CheckoutFlowProps {
  order: PreOrder;
  totalAmount: number;
  currency: string;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

type Stage = 'card-form' | 'pin' | 'otp' | 'processing' | 'done';

function formatCardNumber(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

export function CheckoutFlow({ order, totalAmount, onCancel, onSuccess }: CheckoutFlowProps) {
  const [stage, setStage]   = useState<Stage>('card-form');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Card form
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear]   = useState('');
  const [cvv, setCvv] = useState('');

  // Auth stages
  const [pendingChargeId, setPendingChargeId] = useState('');
  const [pendingTxRef, setPendingTxRef]       = useState('');
  const [pinInput, setPinInput] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const isMpesa  = order.paymentMethod === 'mpesa';
  const isRental = order.orderType === 'rental';

  // ── M-PESA submission ────────────────────────────────────────────────────
  const handleMpesaSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          payment_method:   'mpesa',
        }),
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

  // ── Card payment ─────────────────────────────────────────────────────────
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
        body: JSON.stringify({
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
          payment_method:   'card',
          card: {
            number:       rawNumber,
            expiry_month: expiryMonth,
            expiry_year:  expiryYear,
            cvv,
          },
        }),
      });

      if (!ok) throw new Error(data?.error || 'Card payment failed. Please try again.');

      setPendingChargeId(data.charge_id);
      setPendingTxRef(data.tx_ref || data.short_id);

      const action = data.next_action;
      if (!action) {
        // No auth needed — payment done
        setStage('done');
        onSuccess(data.order_id);
      } else if (action.type === 'redirect_url') {
        // 3DS — redirect to bank
        window.location.href = action.redirect_url?.url || action.redirect_url;
      } else if (action.type === 'requires_pin') {
        setStage('pin');
      } else {
        throw new Error(`Unsupported auth type: ${action.type}. Please try a different card.`);
      }
    } catch (err: any) {
      setError(err.message || 'Card payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── PIN authorization ────────────────────────────────────────────────────
  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length < 4) { setError('Please enter your 4-digit card PIN.'); return; }
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders/card/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charge_id:     pendingChargeId,
          authorization: { type: 'pin', pin: { rawPin: pinInput } },
        }),
      });
      if (!ok) throw new Error(data?.error || 'PIN authorization failed.');

      setPinInput('');
      const action = data.next_action;
      if (!action) {
        setStage('done');
        onSuccess(pendingTxRef);
      } else if (action.type === 'requires_otp' || action.type === 'otp') {
        setStage('otp');
      } else if (action.type === 'redirect_url') {
        window.location.href = action.redirect_url?.url || action.redirect_url;
      } else {
        throw new Error('Could not complete PIN authorization. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP authorization ────────────────────────────────────────────────────
  const handleOtpSubmit = async () => {
    if (!otpInput || otpInput.length < 4) { setError('Please enter the OTP sent to your phone.'); return; }
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders/card/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charge_id:     pendingChargeId,
          authorization: { type: 'otp', otp: { code: otpInput } },
        }),
      });
      if (!ok) throw new Error(data?.error || 'OTP verification failed.');

      setOtpInput('');
      if (!data.next_action) {
        setStage('done');
        onSuccess(pendingTxRef);
      } else {
        throw new Error('Payment could not be completed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setStage('card-form');
    } finally {
      setLoading(false);
    }
  };

  // ── M-PESA UI ────────────────────────────────────────────────────────────
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
        <div className="bg-green-50 border border-green-200 p-3 text-xs rounded text-green-800">
          After placing the order, use your order ID as the M-PESA account number when paying to our paybill.
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleMpesaSubmit} disabled={loading} className="flex-1 text-white py-6 bg-green-600 hover:bg-green-700">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Placing Order...</> : <><Smartphone className="h-4 w-4 mr-2" />Place M-PESA Order</>}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── Card Form ────────────────────────────────────────────────────────────
  if (stage === 'card-form') {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <h3 className="text-xl mb-1">{isRental ? 'Rental — Card Payment' : 'Card Payment'}</h3>
          <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
          {isRental && <p className="text-xs text-gray-500 mt-1">First payment (deposit + 1st month)</p>}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-[#3D3530]">Card Number</Label>
            <Input
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              inputMode="numeric"
              className="mt-1 font-mono tracking-wider"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[#3D3530]">Month</Label>
              <Input
                value={expiryMonth}
                onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="MM"
                maxLength={2}
                inputMode="numeric"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[#3D3530]">Year</Label>
              <Input
                value={expiryYear}
                onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="YYYY"
                maxLength={4}
                inputMode="numeric"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[#3D3530]">CVV</Label>
              <Input
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                maxLength={4}
                inputMode="numeric"
                type="password"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Product</span><span>{order.productName} × {order.quantity}</span></div>
          <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-500">Total</span><span className="font-medium">KES {totalAmount.toLocaleString()}</span></div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleCardSubmit} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <><CreditCard className="h-4 w-4 mr-2" />Pay Now</>}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Lock className="h-3 w-3" />
          <span>Secured by Flutterwave — card details are encrypted</span>
        </div>
      </div>
    );
  }

  // ── PIN Stage ────────────────────────────────────────────────────────────
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
          <Input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter PIN"
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="mt-1 text-center tracking-widest text-lg"
          />
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

  // ── OTP Stage ────────────────────────────────────────────────────────────
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
          <Input
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Enter OTP"
            inputMode="numeric"
            maxLength={8}
            className="mt-1 text-center tracking-widest text-lg"
          />
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

  // ── Done ─────────────────────────────────────────────────────────────────
  return (
    <div className="text-center space-y-4 py-8">
      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
      <h3 className="text-xl text-[#3D3530]">Payment Successful!</h3>
      <p className="text-sm text-gray-500">Your order is confirmed. Check your email for details.</p>
    </div>
  );
}
