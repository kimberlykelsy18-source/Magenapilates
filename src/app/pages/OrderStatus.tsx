import { useState } from 'react';
import { Search, Package, CheckCircle2, Clock, XCircle, AlertCircle, Truck } from 'lucide-react';
import { Link } from 'react-router';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; description: string }> = {
  pending_payment: {
    label: 'Pending Payment',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 border-yellow-200',
    icon: <Clock className="h-8 w-8 text-yellow-500" />,
    description: 'Your order has been placed and is awaiting payment.',
  },
  payment_verification_pending: {
    label: 'Payment Verification Pending',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: <AlertCircle className="h-8 w-8 text-blue-500" />,
    description: 'We have received your M-PESA payment and are verifying it. This usually takes up to 24 hours.',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
    description: 'Your payment has been verified and your order is confirmed. We will be in touch about production and delivery.',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    icon: <Truck className="h-8 w-8 text-green-600" />,
    description: 'Your equipment has been delivered. Thank you for choosing Magena Pilates!',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-200',
    icon: <XCircle className="h-8 w-8 text-gray-400" />,
    description: 'This order has been cancelled.',
  },
  failed: {
    label: 'Payment Failed',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: <XCircle className="h-8 w-8 text-red-500" />,
    description: 'We could not verify your payment. Please contact us with your order ID and M-PESA transaction code.',
  },
};

interface OrderResult {
  order_id: string;
  product_name: string;
  order_type: string;
  status: string;
  customer_name: string;
  created_at: string;
  total_amount: number;
  deposit_amount: number;
  payment_method: string;
}

export function OrderStatus() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = input.trim().toUpperCase();
    if (!orderId) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API}/api/orders/status?order_id=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order not found');
      setResult(data);
    } catch (err: any) {
      setError(err.message === 'Order not found'
        ? 'No order found with that ID. Please check and try again.'
        : err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = result ? (STATUS_CONFIG[result.status] || {
    label: result.status,
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    icon: <Package className="h-8 w-8 text-gray-500" />,
    description: '',
  }) : null;

  return (
    <div className="min-h-screen bg-[#F7F4F0]">
      <header className="bg-[#3D3530] text-[#EBE6DD] py-5 px-4 text-center">
        <Link to="/" className="inline-block">
          <div className="text-lg tracking-[6px] uppercase font-light">Magena Pilates</div>
        </Link>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Package className="h-12 w-12 text-[#3D3530] mx-auto mb-3" />
          <h1 className="text-2xl text-[#3D3530] mb-2">Check Order Status</h1>
          <p className="text-sm text-[#6B5C53]">Enter your order ID to see the latest status of your pre-order.</p>
        </div>

        <form onSubmit={handleSearch} className="bg-white border border-[#3D3530] p-6 mb-6">
          <label className="block text-xs font-bold uppercase tracking-widest text-[#6B5C53] mb-2">
            Order ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. PRE-A001"
              className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530] uppercase placeholder:normal-case"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-[#3D3530] text-white px-4 py-2 hover:bg-[#2D2520] disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </form>

        {result && statusInfo && (
          <div className={`border rounded p-6 ${statusInfo.bg}`}>
            <div className="flex items-start gap-4 mb-5">
              {statusInfo.icon}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Order {result.order_id}</div>
                <div className={`text-lg font-semibold ${statusInfo.color}`}>{statusInfo.label}</div>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-5">{statusInfo.description}</p>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Product</span>
                <span className="font-medium capitalize">{result.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Type</span>
                <span className="capitalize">{result.order_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method</span>
                <span className="uppercase">{result.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span>KES {(Number(result.total_amount) + Number(result.deposit_amount || 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Date</span>
                <span>{new Date(result.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {(result.status === 'failed' || result.status === 'payment_verification_pending') && (
              <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                Need help? Email us at{' '}
                <a href="mailto:magenapilates@gmail.com" className="text-[#3D3530] underline">
                  magenapilates@gmail.com
                </a>{' '}
                with your order ID and M-PESA transaction code.
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-8">
          <Link to="/" className="text-sm text-[#6B5C53] hover:text-[#3D3530] underline">
            ← Back to shop
          </Link>
        </div>
      </main>
    </div>
  );
}
