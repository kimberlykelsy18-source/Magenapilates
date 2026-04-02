import { useState } from 'react';
import { PreOrder } from '../types';
import { Button } from './ui/button';
import { Loader2, CreditCard, Smartphone, ExternalLink } from 'lucide-react';
import { apiFetch } from '../utils/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface CheckoutFlowProps {
  order: PreOrder;
  totalAmount: number;
  currency: string;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

export function CheckoutFlow({ order, totalAmount, currency, onCancel }: CheckoutFlowProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Both card and M-PESA go through Pesapal's hosted checkout.
  // Pesapal handles card entry and M-PESA paybill/payment on their secure page.
  const handlePesapalCheckout = async () => {
    setProcessing(true);
    setError('');

    try {
      const { ok, data } = await apiFetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: order.productId,
          product_name: order.productName,
          order_type: order.orderType,
          quantity: order.quantity,
          wants_engraving: order.wantsEngraving,
          customer_name: order.customerName,
          customer_email: order.customerEmail,
          customer_phone: order.customerPhone,
          customer_address: order.customerAddress,
          notes: order.notes,
          total_amount: order.totalAmount,
          deposit_amount: order.depositAmount || 0,
          payment_method: order.paymentMethod,
        }),
      });

      if (!ok) throw new Error(data?.error || 'Failed to create order');

      // Redirect to Pesapal hosted checkout (handles both card and M-PESA)
      window.location.href = data.redirect_url;
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const isMpesa = order.paymentMethod === 'mpesa';

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b">
        <h3 className="text-xl mb-2">
          {isMpesa ? 'M-PESA Payment via Pesapal' : 'Card Payment via Pesapal'}
        </h3>
        <p className="text-2xl font-medium text-[#3D3530]">
          KES {totalAmount.toLocaleString()}
        </p>
      </div>

      <div className={`flex items-center gap-3 p-4 rounded border ${isMpesa ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
        {isMpesa ? (
          <Smartphone className="h-8 w-8 text-green-700 shrink-0" />
        ) : (
          <CreditCard className="h-8 w-8 text-blue-700 shrink-0" />
        )}
        <div>
          {isMpesa ? (
            <>
              <h4 className="font-medium text-green-900">Pay via M-PESA</h4>
              <p className="text-sm text-green-700">You'll be redirected to Pesapal where you can pay using M-PESA</p>
            </>
          ) : (
            <>
              <h4 className="font-medium text-blue-900">Secure Card Payment</h4>
              <p className="text-sm text-blue-700">Visa, Mastercard — processed by Pesapal</p>
            </>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Product</span>
          <span>{order.productName} × {order.quantity}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Phone</span>
          <span>{order.customerPhone}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-gray-600">Total to Pay</span>
          <span className="font-medium text-lg">KES {totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className={`border p-3 text-xs rounded ${isMpesa ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
        You'll be redirected to Pesapal's secure checkout. {isMpesa ? 'Select M-PESA and follow the prompts to complete payment.' : 'Enter your card details to complete payment.'} You'll return here once done.
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button
          onClick={handlePesapalCheckout}
          disabled={processing}
          className={`flex-1 text-white py-6 ${isMpesa ? 'bg-green-600 hover:bg-green-700' : 'bg-[#3D3530] hover:bg-[#2D2520]'}`}
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Redirecting to Pesapal...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              {isMpesa ? 'Pay with M-PESA' : 'Pay with Card'}
            </>
          )}
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={processing} className="px-6">
          Cancel
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Secured by Pesapal — your payment info is safe</span>
      </div>
    </div>
  );
}
