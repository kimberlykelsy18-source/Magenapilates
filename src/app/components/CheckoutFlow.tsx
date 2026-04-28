import { useState } from 'react';
import { PreOrder } from '../types';
import { Button } from './ui/button';
import { Loader2, Smartphone, Lock, ExternalLink, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface CheckoutFlowProps {
  order: PreOrder;
  totalAmount: number;
  currency: string;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

export function CheckoutFlow({ order, totalAmount, onCancel, onSuccess }: CheckoutFlowProps) {
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const isMpesa = order.paymentMethod === 'mpesa';

  function basePayload() {
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
      setDone(true);
      onSuccess(data.order_id);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── CARD → Paystack hosted checkout (purchase and rental) ─────────────────
  const handleCardCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload()),
      });
      if (!ok) throw new Error(data?.error || 'Failed to initiate checkout');
      window.location.href = data.redirect_url;
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const OrderSummary = () => (
    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
      <div className="flex justify-between"><span className="text-gray-500">Product</span><span>{order.productName} × {order.quantity}</span></div>
      <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-500">Total</span><span className="font-medium">KES {totalAmount.toLocaleString()}</span></div>
    </div>
  );

  // ── M-PESA UI ─────────────────────────────────────────────────────────────
  if (isMpesa) {
    if (done) {
      return (
        <div className="text-center space-y-4 py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h3 className="text-xl text-[#3D3530]">Order Received!</h3>
          <p className="text-sm text-gray-500">Complete your M-PESA payment using the details above. We'll confirm your order within 24 hours.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b">
          <h3 className="text-xl mb-1">M-PESA Payment</h3>
          <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded border bg-green-50 border-green-200 space-y-3">
          <div className="flex items-center gap-3">
            <Smartphone className="h-8 w-8 text-green-700 shrink-0" />
            <h4 className="font-medium text-green-900">M-PESA Paybill Details</h4>
          </div>
          <div className="space-y-2 text-sm text-green-800">
            <div className="flex justify-between">
              <span className="text-green-700">Go to M-PESA → Lipa na M-PESA → Paybill</span>
            </div>
            <div className="flex justify-between border-t border-green-200 pt-2">
              <span className="text-green-700">Business Number (Paybill)</span>
              <span className="font-bold tracking-wide">522533</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Account Number</span>
              <span className="font-bold tracking-wide">8070790</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Account Name</span>
              <span className="font-bold">MAGENA PILATES</span>
            </div>
            <div className="flex justify-between border-t border-green-200 pt-2">
              <span className="text-green-700">Amount</span>
              <span className="font-bold">KES {totalAmount.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-green-700 border-t border-green-200 pt-2">
            Enter your M-PESA PIN and confirm, then click <strong>I Have Made Payment</strong>. We will verify and update your order status.
          </p>
        </div>
        <OrderSummary />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleMpesa} disabled={loading} className="flex-1 text-white py-6 bg-green-600 hover:bg-green-700">
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
              : <><Smartphone className="h-4 w-4 mr-2" />I Have Made Payment</>
            }
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── CARD → Paystack hosted checkout ──────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b">
        <h3 className="text-xl mb-1">
          {order.orderType === 'rental' ? 'Monthly Rental — Subscription' : 'Secure Card Payment'}
        </h3>
        <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
        {order.orderType === 'rental' && (
          <p className="text-xs text-gray-500 mt-1">First payment (deposit + 1st month). Months 2–5 auto-charged monthly.</p>
        )}
      </div>
      <div className="flex items-start gap-3 p-4 rounded border bg-blue-50 border-blue-200">
        <Lock className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900 text-sm">Secured by Paystack</p>
          <p className="text-xs text-blue-700 mt-0.5">
            You'll be redirected to Paystack's secure checkout. Visa, Mastercard, and Verve cards accepted.
          </p>
        </div>
      </div>
      <OrderSummary />
      {order.orderType === 'rental' && (
        <div className="border p-3 text-xs rounded bg-blue-50 border-blue-200 text-blue-800">
          After entering your card on the secure checkout page, your card will be charged automatically each month for 5 months. Subscription stops automatically after the 5th payment.
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={handleCardCheckout} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
          {loading
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting...</>
            : <><ExternalLink className="h-4 w-4 mr-2" />Proceed to Paystack</>
          }
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
      </div>
    </div>
  );
}
