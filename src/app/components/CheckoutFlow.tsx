import { useState } from 'react';
import { PreOrder } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, CheckCircle2, CreditCard, Smartphone } from 'lucide-react';

interface CheckoutFlowProps {
  order: PreOrder;
  totalAmount: number;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CheckoutFlow({ order, totalAmount, currency, onSuccess, onCancel }: CheckoutFlowProps) {
  const [step, setStep] = useState<'payment' | 'processing' | 'success'>('payment');
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });
  const [processing, setProcessing] = useState(false);

  const handleMpesaPayment = () => {
    setProcessing(true);
    setStep('processing');

    // Simulate M-PESA STK push
    setTimeout(() => {
      setProcessing(false);
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 3000);
    }, 5000);
  };

  const handleCardPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setStep('processing');

    // Simulate card payment processing via Pesapal
    setTimeout(() => {
      setProcessing(false);
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 3000);
    }, 4000);
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  if (step === 'processing') {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-[#3D3530]" />
        <h3 className="text-xl mb-2">Processing Payment...</h3>
        {order.paymentMethod === 'mpesa' ? (
          <div className="space-y-2">
            <p className="text-gray-600">
              M-PESA STK Push sent to <strong>{order.customerPhone}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Please enter your M-PESA PIN on your phone to complete payment
            </p>
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded max-w-md mx-auto">
              <p className="text-sm text-green-800">
                Check your phone for the M-PESA payment prompt
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">Securely processing your card payment via Pesapal...</p>
        )}
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
        <h3 className="text-2xl mb-2 text-green-700">Payment Successful!</h3>
        <p className="text-gray-600 mb-4">
          Your pre-order has been confirmed. We'll contact you shortly.
        </p>
        <div className="bg-gray-50 border p-4 max-w-md mx-auto text-left">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-600">Order ID:</span>
            <span className="font-mono">#{order.id}</span>
            <span className="text-gray-600">Amount Paid:</span>
            <span className="font-medium">{currency} {totalAmount.toLocaleString()}</span>
            <span className="text-gray-600">Payment Method:</span>
            <span className="uppercase">{order.paymentMethod}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b">
        <h3 className="text-xl mb-2">Complete Payment</h3>
        <p className="text-2xl font-medium text-[#3D3530]">
          {currency} {totalAmount.toLocaleString()}
        </p>
      </div>

      {order.paymentMethod === 'mpesa' ? (
        // M-PESA Payment
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded">
            <Smartphone className="h-8 w-8 text-green-700" />
            <div>
              <h4 className="font-medium text-green-900">M-PESA Payment</h4>
              <p className="text-sm text-green-700">Pay securely via M-PESA STK Push</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Phone Number:</span>
              <span className="font-medium">{order.customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium">{currency} {totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded text-sm text-blue-900">
            <p className="font-medium mb-2">How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Click "Pay with M-PESA" button below</li>
              <li>You'll receive an M-PESA prompt on {order.customerPhone}</li>
              <li>Enter your M-PESA PIN to complete payment</li>
              <li>You'll receive a confirmation SMS</li>
            </ol>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleMpesaPayment}
              disabled={processing}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-6"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending STK Push...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay with M-PESA
                </>
              )}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              disabled={processing}
              className="px-6"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        // Card Payment
        <form onSubmit={handleCardPayment} className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
            <CreditCard className="h-8 w-8 text-blue-700" />
            <div>
              <h4 className="font-medium text-blue-900">Card Payment</h4>
              <p className="text-sm text-blue-700">Secure payment via Pesapal</p>
            </div>
          </div>

          <div>
            <Label htmlFor="cardNumber">Card Number *</Label>
            <Input
              id="cardNumber"
              required
              maxLength={19}
              placeholder="1234 5678 9012 3456"
              value={cardDetails.cardNumber}
              onChange={(e) => {
                const formatted = formatCardNumber(e.target.value);
                if (formatted.replace(/\s/g, '').length <= 16) {
                  setCardDetails({ ...cardDetails, cardNumber: formatted });
                }
              }}
              className="text-lg tracking-wider"
            />
          </div>

          <div>
            <Label htmlFor="cardName">Cardholder Name *</Label>
            <Input
              id="cardName"
              required
              placeholder="JOHN DOE"
              value={cardDetails.cardName}
              onChange={(e) => setCardDetails({ ...cardDetails, cardName: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiryDate">Expiry Date *</Label>
              <Input
                id="expiryDate"
                required
                placeholder="MM/YY"
                maxLength={5}
                value={cardDetails.expiryDate}
                onChange={(e) => {
                  const formatted = formatExpiry(e.target.value);
                  setCardDetails({ ...cardDetails, expiryDate: formatted });
                }}
              />
            </div>
            <div>
              <Label htmlFor="cvv">CVV *</Label>
              <Input
                id="cvv"
                required
                type="password"
                maxLength={4}
                placeholder="123"
                value={cardDetails.cvv}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setCardDetails({ ...cardDetails, cvv: value });
                }}
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount to charge:</span>
              <span className="font-medium text-lg">{currency} {totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={processing}
              className="flex-1 bg-[#3D3530] hover:bg-[#2D2520] text-white py-6"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay {currency} {totalAmount.toLocaleString()}
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              disabled={processing}
              className="px-6"
            >
              Cancel
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>Secured by Pesapal - Your payment info is safe</span>
          </div>
        </form>
      )}
    </div>
  );
}