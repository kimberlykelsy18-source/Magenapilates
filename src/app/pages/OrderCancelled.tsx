import { Link } from 'react-router';
import { XCircle } from 'lucide-react';

export function OrderCancelled() {
  return (
    <div className="min-h-screen bg-[#EBE6DD] flex items-center justify-center p-4">
      <div className="bg-white border border-[#3D3530] max-w-md w-full rounded overflow-hidden text-center">
        <div className="bg-[#3D3530] px-8 py-6">
          <h1 className="text-[#EBE6DD] text-xl tracking-widest">MAGENA PILATES</h1>
        </div>
        <div className="p-8">
          <XCircle className="h-14 w-14 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl text-[#3D3530] mb-2">Order Cancelled</h2>
          <p className="text-gray-600 text-sm mb-6">
            You cancelled the payment. No charges were made. You can start a new pre-order any time.
          </p>
          <Link
            to="/"
            className="block w-full bg-[#3D3530] text-white py-3 text-sm tracking-wider hover:bg-[#2D2520] transition-colors"
          >
            BACK TO HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
