import { useState } from 'react';
import { Product, PreOrder } from '../types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { CheckoutFlow } from './CheckoutFlow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { convertPrice, type Currency } from '../utils/currency';

interface PreOrderFormProps {
  product: Product;
  quantity: number;
  selectedCurrency: string;
  currencySymbol: string;
  convertedPrices: {
    purchasePrice?: number;
    rentalPrice?: number;
    rentalDeposit?: number;
  };
  onSuccess: () => void;
}

export function PreOrderForm({ product, quantity, selectedCurrency, currencySymbol, convertedPrices, onSuccess }: PreOrderFormProps) {
  const [step, setStep] = useState<'form' | 'checkout'>('form');
  const [pendingOrder, setPendingOrder] = useState<PreOrder | null>(null);
  const [formData, setFormData] = useState({
    orderType: 'purchase' as 'purchase' | 'rental',
    wantsEngraving: false,
    paymentMethod: 'mpesa' as 'mpesa' | 'card',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    notes: '',
  });

  // Convert the engraving value to the selected currency
  const ENGRAVING_VALUE_KES = 3500;
  const convertedEngravingValue = convertPrice(ENGRAVING_VALUE_KES, selectedCurrency as Currency);

  const calculateTotal = () => {
    if (formData.orderType === 'purchase') {
      return (convertedPrices.purchasePrice || 0) * quantity;
    } else {
      return (convertedPrices.rentalPrice || 0) * quantity;
    }
  };

  const getDeposit = () => {
    if (formData.orderType === 'rental') {
      return (convertedPrices.rentalDeposit || 0) * quantity;
    }
    return 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const order: PreOrder = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      orderType: formData.orderType,
      quantity: quantity,
      wantsEngraving: formData.wantsEngraving,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      customerAddress: formData.customerAddress,
      notes: formData.notes,
      totalAmount: calculateTotal(),
      depositAmount: getDeposit(),
      paymentMethod: formData.paymentMethod,
      orderDate: new Date().toISOString(),
      status: 'pending',
    };
    
    setPendingOrder(order);
    setStep('checkout');
  };

  const handlePaymentSuccess = (_orderId?: string) => {
    toast.success('Your pre-order has been placed! Check your email for confirmation.');
    setStep('form');
    setPendingOrder(null);
    onSuccess();
  };

  const handlePaymentCancel = () => {
    setStep('form');
    setPendingOrder(null);
    toast.info('Payment cancelled. You can try again.');
  };

  if (step === 'checkout' && pendingOrder) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && handlePaymentCancel()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#3D3530]">Payment Checkout</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Please review your order and proceed with payment.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4">
            <CheckoutFlow
              order={pendingOrder}
              totalAmount={calculateTotal() + getDeposit()}
              currency={selectedCurrency}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Summary */}
      <div className="bg-gray-50 border p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-[#3D3530]">{product.name}</span>
          <span className="text-sm text-gray-600">Qty: {quantity}</span>
        </div>
      </div>

      {/* Order Type */}
      <div>
        <Label className="text-[#3D3530] mb-2 block">Select Order Type *</Label>
        <RadioGroup
          value={formData.orderType}
          onValueChange={(value) => setFormData({ ...formData, orderType: value as any })}
          className="space-y-3"
        >
          {product.purchasePrice && convertedPrices.purchasePrice && (
            <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
              <RadioGroupItem value="purchase" id="purchase" />
              <Label htmlFor="purchase" className="cursor-pointer flex-1">
                <div className="flex justify-between">
                  <span>Purchase</span>
                  <span className="font-medium">{currencySymbol} {(convertedPrices.purchasePrice * quantity).toLocaleString()}</span>
                </div>
                {quantity > 1 && (
                  <div className="text-xs text-gray-600 mt-1">
                    {currencySymbol} {convertedPrices.purchasePrice.toLocaleString()} × {quantity}
                  </div>
                )}
              </Label>
            </div>
          )}
          {product.rentalPrice && convertedPrices.rentalPrice && (
            <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
              <RadioGroupItem value="rental" id="rental" />
              <Label htmlFor="rental" className="cursor-pointer flex-1">
                <div>
                  <div className="flex justify-between">
                    <span>Rental (Monthly)</span>
                    <span className="font-medium">{currencySymbol} {convertedPrices.rentalPrice.toLocaleString()}/month</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    + {currencySymbol} {((convertedPrices.rentalDeposit || 0) * quantity).toLocaleString()} refundable deposit
                    {quantity > 1 && ` (${currencySymbol} ${convertedPrices.rentalDeposit?.toLocaleString()} × ${quantity})`}
                  </div>
                  <div className="text-xs text-gray-600">
                    Fixed rate for first 5 months
                  </div>
                </div>
              </Label>
            </div>
          )}
        </RadioGroup>
      </div>

      {/* Free Engraving */}
      {formData.orderType === 'purchase' && (
        <div className="border border-green-600 p-3 bg-green-50">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="engraving"
              checked={formData.wantsEngraving}
              onCheckedChange={(checked) => setFormData({ ...formData, wantsEngraving: checked as boolean })}
            />
            <div className="flex-1">
              <Label htmlFor="engraving" className="cursor-pointer">
                <div className="font-medium text-green-900">Add FREE Logo Engraving</div>
                <div className="text-xs text-green-800">Pre-order bonus - worth {currencySymbol} {convertedEngravingValue.toLocaleString()} per equipment ({currencySymbol} {(convertedEngravingValue * quantity).toLocaleString()} total value)</div>
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-medium text-[#3D3530]">Customer Information</h3>
        
        <div>
          <Label htmlFor="name" className="text-[#3D3530]">Full Name *</Label>
          <Input
            id="name"
            required
            value={formData.customerName}
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            className="mt-1"
            placeholder="John Doe"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-[#3D3530]">Email Address *</Label>
          <Input
            id="email"
            type="email"
            required
            value={formData.customerEmail}
            onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
            className="mt-1"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <Label htmlFor="phone" className="text-[#3D3530]">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            required
            placeholder="0712345678 or +254712345678"
            value={formData.customerPhone}
            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            className="mt-1"
          />
          <p className="text-xs text-gray-600 mt-1">For M-PESA payments or contact purposes</p>
        </div>

        <div>
          <Label htmlFor="address" className="text-[#3D3530]">Delivery Address *</Label>
          <Textarea
            id="address"
            required
            placeholder="Enter your full delivery address including city and postal code"
            value={formData.customerAddress}
            onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
            className="mt-1"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="notes" className="text-[#3D3530]">Additional Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special requests, delivery instructions, or questions..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="mt-1"
            rows={2}
          />
        </div>

        {/* Payment Method */}
        <div>
          <Label className="text-[#3D3530] mb-2 block">Payment Method *</Label>
          <RadioGroup
            value={formData.paymentMethod}
            onValueChange={(value) => setFormData({ ...formData, paymentMethod: value as 'mpesa' | 'card' })}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
              <RadioGroupItem value="mpesa" id="mpesa" />
              <Label htmlFor="mpesa" className="cursor-pointer flex-1">
                <div>
                  <span className="font-medium">M-PESA</span>
                  <div className="text-xs text-gray-600 mt-1">For Kenyan customers - Pay via M-PESA</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
              <RadioGroupItem value="card" id="card" />
              <Label htmlFor="card" className="cursor-pointer flex-1">
                <div>
                  <span className="font-medium">Debit/Credit Card</span>
                  <div className="text-xs text-gray-600 mt-1">For international customers - Visa, Mastercard, etc.</div>
                </div>
              </Label>
            </div>
          </RadioGroup>
          {formData.paymentMethod === 'card' && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 text-sm text-blue-900">
              <p>Card payments are processed securely via Flutterwave. You'll be redirected to complete payment after submitting.{formData.orderType === 'rental' ? ' Your card will be enrolled for automatic monthly billing.' : ''}</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="border-t pt-4 bg-gray-50 p-4">
        <h3 className="font-medium text-[#3D3530] mb-3">Order Summary</h3>
        <div className="space-y-2 text-[#3D3530]">
          <div className="flex justify-between text-sm">
            <span>Product:</span>
            <span>{product.name} × {quantity}</span>
          </div>
          <div className="flex justify-between">
            <span>{formData.orderType === 'purchase' ? 'Purchase Price:' : 'Monthly Rental:'}</span>
            <span className="font-medium">{currencySymbol} {calculateTotal().toLocaleString()}</span>
          </div>
          {getDeposit() > 0 && (
            <div className="flex justify-between">
              <span>Refundable Deposit:</span>
              <span className="font-medium">{currencySymbol} {getDeposit().toLocaleString()}</span>
            </div>
          )}
          {formData.wantsEngraving && (
            <div className="flex justify-between text-green-700">
              <span>FREE Engraving:</span>
              <span className="font-medium">{currencySymbol} 0 (saves {currencySymbol} {(convertedEngravingValue * quantity).toLocaleString()})</span>
            </div>
          )}
          <div className="flex justify-between text-lg border-t pt-2 mt-2">
            <span className="font-medium">
              {formData.orderType === 'purchase' ? 'Total Amount:' : 'Due Now (Deposit + 1st Month):'}
            </span>
            <span className="font-medium">{currencySymbol} {(calculateTotal() + getDeposit()).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-[#3D3530] text-white py-4 text-lg hover:bg-[#2D2520] transition-colors"
      >
        PROCEED TO PAYMENT
      </button>
    </form>
  );
}