import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Order {
  id: string;
  short_id: string;
  product_name: string;
  order_type: string;
  quantity: number;
  total_amount: number;
  deposit_amount: number;
  customer_name: string;
  customer_email: string;
  status: string;
}

export function OrderSuccess() {
  const [params] = useSearchParams();
  // Pesapal appends OrderTrackingId to the callback URL automatically after payment
  const trackingId = params.get('OrderTrackingId');

  const [status, setStatus] = useState<'loading' | 'completed' | 'failed' | 'pending' | 'error'>('loading');
  const [order, setOrder] = useState<Order | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!trackingId) {
      setStatus('error');
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const { data } = await apiFetch(`${API}/api/pesapal/status/${trackingId}`);

        if (cancelled) return;

        if (data.status === 'completed') {
          setOrder(data.order);
          setStatus('completed');
        } else if (data.status === 'failed' || data.status === 'reversed') {
          setStatus('failed');
        } else {
          // Still pending — retry up to 10 times (every 3 seconds)
          setAttempts((a) => {
            const next = a + 1;
            if (next < 10) {
              setTimeout(poll, 3000);
            } else {
              setStatus('pending');
            }
            return next;
          });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    poll();

    return () => { cancelled = true; };
  }, [trackingId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#EBE6DD] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-[#3D3530]" />
          <h2 className="text-xl text-[#3D3530] mb-2">Verifying your payment...</h2>
          <p className="text-sm text-gray-500">Please wait, this may take a few seconds.</p>
          {attempts > 3 && (
            <p className="text-xs text-gray-400 mt-2">Still checking... ({attempts}/10)</p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'completed' && order) {
    const amountPaid = (Number(order.total_amount) + Number(order.deposit_amount || 0)).toLocaleString();
    return (
      <div className="min-h-screen bg-[#EBE6DD] flex items-center justify-center p-4">
        <div className="bg-white border border-[#3D3530] max-w-md w-full rounded overflow-hidden">
          {/* Header */}
          <div className="bg-[#3D3530] px-8 py-6 text-center">
            <h1 className="text-[#EBE6DD] text-xl tracking-widest">MAGENA PILATES</h1>
          </div>

          {/* Success banner */}
          <div className="bg-green-600 px-8 py-5 text-center">
            <CheckCircle2 className="h-10 w-10 text-white mx-auto mb-2" />
            <p className="text-white/80 text-xs uppercase tracking-widest mb-1">Pre-Order Confirmed</p>
            <h2 className="text-white text-2xl font-medium">{order.short_id}</h2>
          </div>

          {/* Body */}
          <div className="p-8">
            <p className="text-gray-600 mb-6 text-sm">
              Hi <strong>{order.customer_name}</strong>! Your pre-order is confirmed and a receipt has been sent to <strong>{order.customer_email}</strong>.
            </p>

            <div className="bg-[#F7F4F0] rounded p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Order ID</span>
                <span className="font-medium text-[#3D3530]">{order.short_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Product</span>
                <span>{order.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="capitalize">{order.order_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity</span>
                <span>{order.quantity}</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-gray-500">Amount Paid</span>
                <span className="font-medium text-green-700">KES {amountPaid}</span>
              </div>
            </div>

            <div className="mt-6 bg-green-50 border-l-4 border-green-500 p-3 text-xs text-green-800">
              We'll contact you at {order.customer_email} with delivery timelines and next steps.
            </div>

            <Link
              to="/"
              className="mt-6 block w-full bg-[#3D3530] text-white py-3 text-center text-sm tracking-wider hover:bg-[#2D2520] transition-colors"
            >
              BACK TO HOME
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-[#EBE6DD] flex items-center justify-center p-4">
        <div className="bg-white border border-[#3D3530] max-w-md w-full rounded overflow-hidden text-center">
          <div className="bg-[#3D3530] px-8 py-6">
            <h1 className="text-[#EBE6DD] text-xl tracking-widest">MAGENA PILATES</h1>
          </div>
          <div className="p-8">
            <XCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl text-[#3D3530] mb-2">Payment Failed</h2>
            <p className="text-gray-600 text-sm mb-6">
              Your payment was not successful. No charges have been made. Please try again.
            </p>
            <Link
              to="/"
              className="block w-full bg-[#3D3530] text-white py-3 text-sm tracking-wider hover:bg-[#2D2520] transition-colors"
            >
              TRY AGAIN
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // pending (timed out polling) or error
  return (
    <div className="min-h-screen bg-[#EBE6DD] flex items-center justify-center p-4">
      <div className="bg-white border border-[#3D3530] max-w-md w-full rounded p-8 text-center">
        <Loader2 className="h-12 w-12 text-[#3D3530] mx-auto mb-4" />
        <h2 className="text-xl text-[#3D3530] mb-2">Payment Pending</h2>
        <p className="text-gray-600 text-sm mb-6">
          We're still waiting for payment confirmation from Pesapal. Check your email — if payment went through you'll receive a confirmation shortly.
        </p>
        <p className="text-xs text-gray-400 mb-6">Tracking ID: {trackingId}</p>
        <Link
          to="/"
          className="block w-full bg-[#3D3530] text-white py-3 text-sm tracking-wider hover:bg-[#2D2520] transition-colors"
        >
          BACK TO HOME
        </Link>
      </div>
    </div>
  );
}
