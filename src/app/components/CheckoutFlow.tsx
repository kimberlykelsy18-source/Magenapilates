import { useState, useEffect } from 'react';
import PaystackPop from '@paystack/inline-js';
import { PreOrder } from '../types';
import { Button } from './ui/button';
import { Loader2, Smartphone, Lock, CreditCard, CheckCircle2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/api';

import { API_URL as API } from '../utils/config';
const DEFAULT_PAYBILL = '522533';

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

  // M-PESA: pre-created order details
  const [mpesaOrderId, setMpesaOrderId]   = useState<string | null>(null);
  const [mpesaShortId, setMpesaShortId]   = useState<string | null>(null);
  const [mpesaPaybill, setMpesaPaybill]   = useState(DEFAULT_PAYBILL);

  const isMpesa = order.paymentMethod === 'mpesa';

  function basePayload() {
    return {
      product_id:                    order.productId,
      product_name:                  order.productName,
      order_type:                    order.orderType,
      quantity:                      order.quantity,
      wants_engraving:               order.wantsEngraving,
      engraving_text:                order.engravingText,
      leather_finish:                order.leatherFinish,
      wood_finish:                   order.woodFinish,
      height_range:                  order.heightRange,
      context_of_use:                order.contextOfUse,
      business_name:                 order.businessName,
      business_email:                order.businessEmail,
      business_type:                 order.businessType,
      business_registration_number:  order.businessRegistrationNumber,
      business_address:              order.businessAddress,
      rental_agreement_signed:       order.rentalAgreementSigned,
      rental_agreement_name:         order.rentalAgreementName,
      customer_name:                 order.customerName,
      customer_email:                order.customerEmail,
      customer_phone:                order.customerPhone,
      customer_address:              order.customerAddress,
      city_town:                     order.cityTown,
      whatsapp_number:               order.whatsappNumber,
      customer_country:              order.customerCountry,
      notes:                         order.notes,
      total_amount:                  order.totalAmount,
      deposit_amount:                order.depositAmount || 0,
      payment_method:                order.paymentMethod,
    };
  }

  // ── M-PESA: pre-create the order on mount so we have the short ID ──────────
  const createMpesaOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload()),
      });
      if (!ok) throw new Error(data?.error || 'Failed to place order');
      setMpesaOrderId(data.order_id);
      setMpesaShortId(data.short_id);
      if (data.mpesa_paybill) setMpesaPaybill(data.mpesa_paybill);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMpesa) createMpesaOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CARD → Paystack inline popup ──────────────────────────────────────────
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

      setLoading(false);

      const popup = new PaystackPop();
      popup.resumeTransaction(data.access_code, {
        onSuccess: (transaction) => {
          window.location.href = `/order-success?reference=${encodeURIComponent(transaction.reference)}`;
        },
        onCancel: () => {
          setError('Payment cancelled. You can try again when ready.');
        },
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const OrderSummary = () => (
    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-gray-500">Product</span>
        <span>{order.productName} × {order.quantity}</span>
      </div>
      {order.customerCountry && (
        <div className="flex justify-between">
          <span className="text-gray-500">Country</span>
          <span>{order.customerCountry}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-1 mt-1">
        <span className="text-gray-500">Total</span>
        <span className="font-medium">KES {totalAmount.toLocaleString()}</span>
      </div>
    </div>
  );

  // ── M-PESA success state ──────────────────────────────────────────────────
  if (isMpesa && done) {
    return (
      <div className="text-center space-y-4 py-8">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <h3 className="text-xl text-[#3D3530]">Payment Submitted!</h3>
        <p className="text-sm text-gray-600 max-w-sm mx-auto">
          Thank you — we've received your order. Our team will verify your M-PESA payment within a few hours and update your order status. Check your email for details.
        </p>
        {mpesaShortId && (
          <p className="text-xs text-gray-500">
            Your Order ID: <strong className="font-mono">{mpesaShortId}</strong>
            <br />Track your order at <strong>/order-status</strong>
          </p>
        )}
        <Button
          onClick={() => { if (mpesaOrderId) onSuccess(mpesaOrderId); }}
          className="bg-[#3D3530] text-white hover:bg-[#2D2520]"
        >
          Done
        </Button>
      </div>
    );
  }

  // ── M-PESA instructions ───────────────────────────────────────────────────
  if (isMpesa) {
    // Show spinner while pre-creating the order
    if (loading && !mpesaShortId) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#3D3530]" />
          <span className="text-sm">Preparing your order...</span>
        </div>
      );
    }

    // Error creating the order
    if (error && !mpesaShortId) {
      return (
        <div className="space-y-4 py-6 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={createMpesaOrder} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Try Again
            </Button>
            <Button onClick={onCancel} variant="outline">Cancel</Button>
          </div>
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
            <h4 className="font-medium text-green-900">How to Pay via M-PESA Paybill</h4>
          </div>
          <ol className="space-y-2.5 text-sm text-green-800">
            {[
              'Open M-PESA on your phone.',
              'Select "Lipa na M-PESA".',
              'Select "Pay Bill".',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">4</span>
              <span>Enter Business Number: <strong className="font-bold tracking-wider">{mpesaPaybill}</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">5</span>
              <span>
                Enter Account Number:{' '}
                {mpesaShortId
                  ? <strong className="font-bold tracking-wider">{mpesaShortId}</strong>
                  : <span className="inline-block w-16 h-4 bg-green-200 animate-pulse rounded" />
                }
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">6</span>
              <span>Enter Amount: <strong>KES {totalAmount.toLocaleString()}</strong>, then enter your M-PESA PIN and confirm.</span>
            </li>
          </ol>
          <p className="text-xs text-green-700 border-t border-green-200 pt-2">
            Once you've completed the payment, click <strong>I Have Made Payment</strong> below. We'll verify and confirm your order within a few hours.
          </p>
        </div>

        <OrderSummary />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button
            onClick={() => setDone(true)}
            disabled={!mpesaShortId}
            className="flex-1 text-white py-6 bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            I Have Made Payment
          </Button>
          <Button onClick={onCancel} variant="outline" className="px-6">Cancel</Button>
        </div>
      </div>
    );
  }

  // ── Card (Paystack) ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b">
        <h3 className="text-xl mb-1">
          {order.orderType === 'rental' ? 'Rental — First Payment' : 'Secure Card Payment'}
        </h3>
        <p className="text-2xl font-medium text-[#3D3530]">KES {totalAmount.toLocaleString()}</p>
        {order.orderType === 'rental' && (
          <p className="text-xs text-gray-500 mt-1">Deposit + 1st month. Months 2–5 auto-charged monthly.</p>
        )}
      </div>

      <div className="flex items-start gap-3 p-4 rounded border bg-blue-50 border-blue-200">
        <Lock className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900 text-sm">Secured by Paystack</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Your card details are entered securely via Paystack. Visa, Mastercard, and Verve cards accepted.
          </p>
        </div>
      </div>

      <OrderSummary />

      {order.orderType === 'rental' && (
        <div className="border p-3 text-xs rounded bg-blue-50 border-blue-200 text-blue-800">
          After entering your card details, your card will be charged automatically each month for 5 months. The subscription stops automatically after the 5th payment.
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={handleCardCheckout} disabled={loading} className="flex-1 text-white py-6 bg-[#3D3530] hover:bg-[#2D2520]">
          {loading
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
            : <><CreditCard className="h-4 w-4 mr-2" />Pay with Card</>
          }
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={loading} className="px-6">Cancel</Button>
      </div>
    </div>
  );
}
