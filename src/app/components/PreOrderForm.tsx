'use client';
import { useState, useEffect, useRef } from 'react';
import { Product, PreOrder, CountrySettings } from '../types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { CheckoutFlow } from './CheckoutFlow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { convertPrice, type Currency } from '../utils/currency';
import { Building2, Search } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

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

interface FinishOption {
  id: string;
  name: string;
  imageUrl?: string;
}

const BUSINESS_TYPES = [
  'Pilates Studio',
  'Yoga Studio',
  'Gym / Fitness Center',
  'Wellness Center',
  'Physiotherapy Clinic',
  'Hotel / Spa',
  'Other Commercial Facility',
];

const HEIGHT_RANGES = [
  'Under 155 cm',
  '155–165 cm',
  '166–175 cm',
  '176–185 cm',
  'Over 185 cm',
];

const ALL_COUNTRIES = [
  'Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Somalia', 'South Sudan',
  'Burundi', 'Djibouti', 'Eritrea', 'South Africa', 'Nigeria', 'Ghana', 'Egypt',
  'Morocco', 'Algeria', 'Tunisia', 'Botswana', 'Namibia', 'Zimbabwe', 'Zambia',
  'Malawi', 'Mozambique', 'Mauritius', 'Seychelles', 'USA', 'United States',
  'UK', 'United Kingdom', 'Canada', 'Australia', 'New Zealand', 'Germany',
  'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Poland',
  'Czech Republic', 'Hungary', 'Romania', 'Greece', 'India', 'China', 'Japan',
  'South Korea', 'Singapore', 'Malaysia', 'Thailand', 'Indonesia', 'Philippines',
  'Vietnam', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Israel', 'Turkey', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
  'Mexico', 'Other',
];

const RENTAL_AGREEMENT_TEXT = `RENTAL AGREEMENT FOR PILATES EQUIPMENT

This Rental Agreement is entered into between Magena Pilates ("Company") and the Business identified in this order form ("Client").

1. EQUIPMENT & RENTAL PERIOD
   The Client agrees to rent the specified Pilates equipment for a minimum fixed period of 5 months, with monthly rental payments as agreed.

2. COMMERCIAL USE ONLY
   The rental equipment is strictly for commercial use in a registered business premises (studio, gym, clinic, hotel, etc.). Residential or personal use is not permitted.

3. PAYMENT TERMS
   Monthly rental payments are due in advance. A refundable security deposit is required before delivery.

4. EQUIPMENT CARE & LIABILITY
   The Client is fully responsible for the equipment during the rental period. The equipment must be maintained in good condition. Any damage beyond normal wear and tear will be charged to the Client.

5. EQUIPMENT LOCATION
   Equipment must remain at the registered business address provided in this agreement. Relocation requires prior written approval from Magena Pilates.

6. RETURN CONDITIONS
   Equipment must be returned in good condition at the end of the rental period. The security deposit will be refunded within 14 business days of satisfactory return.

7. BRANDING
   Rental equipment carries Magena Pilates branding. Custom finishes and engraving are available only on purchase orders.

By signing below, I confirm that I am authorised to enter this agreement on behalf of the business, and that all information provided is accurate.`;

export function PreOrderForm({ product, quantity: initialQuantity, selectedCurrency, currencySymbol, convertedPrices, onSuccess }: PreOrderFormProps) {
  const [step, setStep] = useState<'form' | 'rental-agreement' | 'checkout'>('form');
  const [quantity, setQuantity] = useState(initialQuantity);
  const [pendingOrder, setPendingOrder] = useState<PreOrder | null>(null);
  const [countries, setCountries] = useState<CountrySettings[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountrySettings | null>(null);
  const [siteFinishes, setSiteFinishes] = useState<{ leather: string[]; wood: string[] }>({ leather: [], wood: [] });
  const [countrySearch, setCountrySearch] = useState('');
  const [engravingImagePreview, setEngravingImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    orderType: 'purchase' as 'purchase' | 'rental',
    leatherFinish: '',
    woodFinish: '',
    wantsEngraving: false,
    engravingText: '',
    engravingImage: null as string | null,
    heightRange: '',
    businessName: '',
    businessEmail: '',
    businessType: '',
    businessRegistrationNumber: '',
    businessAddress: '',
    rentalAgreementSigned: false,
    rentalAgreementName: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    cityTown: '',
    whatsappNumber: '',
    customerCountry: selectedCurrency === 'KES' ? 'Kenya' : '',
    notes: '',
    paymentMethod: 'mpesa' as 'mpesa' | 'card',
  });

  useEffect(() => {
    fetch(`${API}/api/settings/countries`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCountries(data);
          if (selectedCurrency === 'KES') {
            const kenya = data.find((c: CountrySettings) => c.country_name === 'Kenya') || null;
            setSelectedCountry(kenya);
          }
        }
      })
      .catch(() => {});

    fetch(`${API}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setSiteFinishes({ leather: data.leather_finishes || [], wood: data.wood_finishes || [] });
        }
      })
      .catch(() => {});
  }, []);

  const leatherOptions: FinishOption[] = (product.leatherFinishes?.length ? product.leatherFinishes : siteFinishes.leather)
    .map((name) => ({ id: name, name }));
  const woodOptions: FinishOption[] = (product.woodFinishes?.length ? product.woodFinishes : siteFinishes.wood)
    .map((name) => ({ id: name, name }));

  const vatRate = selectedCountry ? selectedCountry.vat_rate / 100 : 0.16;
  const taxLabel = selectedCountry?.tax_label || 'VAT';
  const vatPercent = selectedCountry ? selectedCountry.vat_rate : 16;
  const rentalAvailableInCountry = !selectedCountry || selectedCountry.rental_available;
  const convertedEngravingValue = convertPrice(3500, selectedCurrency as Currency);

  const getSubtotal = () =>
    formData.orderType === 'purchase'
      ? (convertedPrices.purchasePrice || 0) * quantity
      : (convertedPrices.rentalPrice || 0) * quantity;

  const getVAT = () => formData.orderType === 'purchase' ? Math.round(getSubtotal() * vatRate) : 0;
  const calculateTotal = () => getSubtotal() + getVAT();
  const getDeposit = () =>
    formData.orderType === 'rental' ? (convertedPrices.rentalDeposit || 0) * quantity : 0;

  const handleCountryChange = (countryName: string) => {
    const country = countries.find((c) => c.country_name === countryName) || null;
    setSelectedCountry(country);
    setFormData((prev) => ({
      ...prev,
      customerCountry: countryName,
      orderType: prev.orderType === 'rental' && country && !country.rental_available ? 'purchase' : prev.orderType,
    }));
    if (countryName !== 'Kenya' && formData.orderType === 'rental') {
      toast.info('Rentals are only available in Kenya. Switched to purchase order.');
    }
  };

  const set = (fields: Partial<typeof formData>) => setFormData((prev) => ({ ...prev, ...fields }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setEngravingImagePreview(result);
        set({ engravingImage: result });
        toast.success('Logo uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerCountry) { toast.error('Please select your country'); return; }
    if (product.hasHeightSizing && !formData.heightRange) { toast.error('Please select your height range'); return; }
    if (formData.wantsEngraving && !formData.engravingText.trim() && !formData.engravingImage) {
      toast.error('Please enter engraving text or upload a logo'); return;
    }
    if (formData.orderType === 'rental') {
      if (!formData.businessName.trim()) { toast.error('Business name is required for rental'); return; }
      if (!formData.businessType) { toast.error('Business type is required for rental'); return; }
      if (!formData.businessRegistrationNumber.trim()) { toast.error('Business registration number is required for rental'); return; }
      if (!formData.businessAddress.trim()) { toast.error('Business physical address is required for rental'); return; }
      setStep('rental-agreement');
      return;
    }
    proceedToPayment();
  };

  const proceedToPayment = () => {
    const order: PreOrder = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      orderType: formData.orderType,
      quantity,
      wantsEngraving: formData.wantsEngraving,
      engravingText: formData.engravingText || undefined,
      leatherFinish: formData.leatherFinish || undefined,
      woodFinish: formData.woodFinish || undefined,
      heightRange: formData.heightRange || undefined,
      contextOfUse: formData.orderType === 'rental' ? formData.businessType || undefined : undefined,
      businessName: formData.businessName || undefined,
      businessEmail: formData.businessEmail || undefined,
      businessType: formData.businessType || undefined,
      businessRegistrationNumber: formData.businessRegistrationNumber || undefined,
      businessAddress: formData.businessAddress || undefined,
      rentalAgreementSigned: formData.rentalAgreementSigned || undefined,
      rentalAgreementName: formData.rentalAgreementName || undefined,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      customerAddress: formData.customerAddress,
      cityTown: formData.cityTown || undefined,
      whatsappNumber: formData.whatsappNumber || undefined,
      customerCountry: formData.customerCountry,
      notes: formData.notes.slice(0, 200),
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
    const bulk = quantity > 2
      ? ' Since this is a bulk order, delivery timeline will be confirmed once equipment is ready.'
      : '';
    if (formData.paymentMethod === 'mpesa') {
      toast.success(
        `Order submitted! Your payment is pending verification. We will contact you within 48 hours.${bulk}`,
        { duration: 10000 }
      );
    } else {
      toast.success(
        `Thank you! We will contact you within 48 hours to confirm your delivery timeline.${bulk}`,
        { duration: 8000 }
      );
    }
    setStep('form');
    setPendingOrder(null);
    onSuccess();
  };

  const handlePaymentCancel = () => {
    setStep('form');
    setPendingOrder(null);
    toast.info('Payment cancelled. You can try again.');
  };

  // ── Rental Agreement step ───────────────────────────────────────────────────
  if (step === 'rental-agreement') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#3D3530] p-6">
          <h3 className="text-xl font-medium text-[#3D3530] mb-4">Rental Agreement</h3>
          <div className="bg-gray-50 border border-gray-300 p-4 mb-6 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
              {RENTAL_AGREEMENT_TEXT}
            </pre>
          </div>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-300 p-4 rounded">
              <p className="text-sm text-yellow-900">
                <strong>Please read the rental agreement carefully.</strong>{' '}
                By signing below, you acknowledge that you have read and agree to all terms and conditions.
              </p>
            </div>
            <div>
              <Label htmlFor="signature" className="text-[#3D3530]">Signature (Type Your Full Name) *</Label>
              <Input
                id="signature"
                required
                value={formData.rentalAgreementName}
                onChange={(e) => set({ rentalAgreementName: e.target.value })}
                className="mt-1"
                placeholder="Type your full name as signature"
              />
              <p className="text-xs text-gray-600 mt-1">This constitutes your legal signature and agreement to the terms above</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 bg-gray-50 p-3 border">
              <div><strong>Business:</strong> {formData.businessName}</div>
              <div><strong>Contact:</strong> {formData.customerName}</div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('form')}
            className="flex-1 border border-[#3D3530] text-[#3D3530] py-3 hover:bg-gray-50 transition-colors"
          >
            Back to Form
          </button>
          <button
            type="button"
            onClick={() => {
              if (!formData.rentalAgreementName.trim()) {
                toast.error('Please sign the agreement');
                return;
              }
              set({ rentalAgreementSigned: true });
              proceedToPayment();
            }}
            className="flex-1 bg-[#3D3530] text-white py-3 hover:bg-[#2D2520] transition-colors"
          >
            I Agree — Continue to Payment
          </button>
        </div>
      </div>
    );
  }

  // ── Checkout step ───────────────────────────────────────────────────────────
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

  // ── Main form ────────────────────────────────────────────────────────────────
  const filteredCountries = ALL_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product summary + quantity */}
      <div className="bg-gray-50 border p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-[#3D3530]">{product.name}</span>
        </div>
        <div className="mt-3">
          <label className="block text-sm text-[#3D3530] mb-2">Quantity:</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="border border-[#3D3530] p-2 hover:bg-gray-100"
            >
              <span className="text-sm">−</span>
            </button>
            <span className="text-lg font-medium w-12 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="border border-[#3D3530] p-2 hover:bg-gray-100"
            >
              <span className="text-sm">+</span>
            </button>
          </div>
        </div>
      </div>

      {/* Order Type */}
      <div>
        <Label className="text-[#3D3530] mb-2 block">Select Order Type *</Label>
        <RadioGroup
          value={formData.orderType}
          onValueChange={(v) => set({ orderType: v as any, businessType: '' })}
          className="space-y-3"
        >
          {product.purchasePrice && convertedPrices.purchasePrice && (
            <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
              <RadioGroupItem value="purchase" id="purchase" />
              <Label htmlFor="purchase" className="cursor-pointer flex-1">
                <div className="flex justify-between">
                  <span>Buy</span>
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

          {selectedCurrency === 'KES' && formData.customerCountry === 'Kenya' && product.rentalPrice && convertedPrices.rentalPrice ? (
            <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
              <RadioGroupItem value="rental" id="rental" />
              <Label htmlFor="rental" className="cursor-pointer flex-1">
                <div className="flex justify-between">
                  <span>Rental (Monthly — Commercial Use Only)</span>
                  <span className="font-medium shrink-0 ml-2">{currencySymbol} {convertedPrices.rentalPrice.toLocaleString()}/month</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  + {currencySymbol} {((convertedPrices.rentalDeposit || 0) * quantity).toLocaleString()} refundable deposit
                  {quantity > 1 && ` (${currencySymbol} ${convertedPrices.rentalDeposit?.toLocaleString()} × ${quantity})`}
                </div>
                <div className="text-xs text-blue-700 mt-1">Commercial use only · Business registration required</div>
              </Label>
            </div>
          ) : product.rentalPrice ? (
            <div className="p-3 bg-gray-50 border border-gray-300 text-sm text-gray-600">
              Rentals available in Kenya only (commercial use — studios/gyms)
            </div>
          ) : null}
        </RadioGroup>
      </div>

      {/* Height Range */}
      {product.hasHeightSizing && (
        <div>
          <Label htmlFor="height_range" className="text-[#3D3530]">Select Your Height *</Label>
          <Select value={formData.heightRange} onValueChange={(v) => set({ heightRange: v })}>
            <SelectTrigger id="height_range" className="mt-1">
              <SelectValue placeholder="Select your height range..." />
            </SelectTrigger>
            <SelectContent>
              {HEIGHT_RANGES.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">We size each barrel to your height for optimal spinal articulation.</p>
        </div>
      )}

      {/* Customization Options */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-medium text-[#3D3530]">Customization Options</h3>

        {formData.orderType === 'purchase' && (
          <>
            {/* Engraving */}
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="engraving"
                  checked={formData.wantsEngraving}
                  onCheckedChange={(checked) => set({ wantsEngraving: checked as boolean, engravingText: '', engravingImage: null })}
                />
                <div className="flex-1">
                  <Label htmlFor="engraving" className="cursor-pointer">
                    <div className="font-medium text-[#3D3530]">
                      Add Personal Engraving — {currencySymbol} {(convertedEngravingValue * quantity).toLocaleString()} per equipment
                    </div>
                  </Label>
                </div>
              </div>
              {formData.wantsEngraving && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label htmlFor="engravingText" className="text-[#3D3530]">Engraving text (max 30 characters)</Label>
                    <Input
                      id="engravingText"
                      maxLength={30}
                      value={formData.engravingText}
                      onChange={(e) => set({ engravingText: e.target.value })}
                      className="mt-1"
                      placeholder="Enter your engraving text"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formData.engravingText.length}/30 characters</p>
                  </div>
                  <div>
                    <Label className="text-[#3D3530]">Or upload logo image</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="mt-1"
                    />
                    {engravingImagePreview && (
                      <div className="mt-2 border p-2">
                        <img src={engravingImagePreview} alt="Logo preview" className="h-20 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Wood Finish */}
            {woodOptions.length > 0 && (
              <div>
                <Label className="text-[#3D3530]">Wood Finishing Preference (free)</Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {woodOptions.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => set({ woodFinish: opt.name })}
                      className={`border-2 p-2 cursor-pointer transition-all ${formData.woodFinish === opt.name ? 'border-[#3D3530] bg-gray-50' : 'border-gray-300 hover:border-gray-400'}`}
                    >
                      {opt.imageUrl
                        ? <img src={opt.imageUrl} alt={opt.name} className="w-full h-20 object-cover mb-2" />
                        : <div className="w-full h-20 bg-gray-100 mb-2 flex items-center justify-center text-xs text-gray-500">No image</div>
                      }
                      <p className="text-xs text-center font-medium text-[#3D3530]">{opt.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leather Finish */}
            {leatherOptions.length > 0 && (
              <div>
                <Label className="text-[#3D3530]">Leather Finish Preference (free)</Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {leatherOptions.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => set({ leatherFinish: opt.name })}
                      className={`border-2 p-2 cursor-pointer transition-all ${formData.leatherFinish === opt.name ? 'border-[#3D3530] bg-gray-50' : 'border-gray-300 hover:border-gray-400'}`}
                    >
                      {opt.imageUrl
                        ? <img src={opt.imageUrl} alt={opt.name} className="w-full h-20 object-cover mb-2" />
                        : <div className="w-full h-20 bg-gray-100 mb-2 flex items-center justify-center text-xs text-gray-500">No image</div>
                      }
                      <p className="text-xs text-center font-medium text-[#3D3530]">{opt.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600">Leather and wood customisation is free. Engraving is for buy orders only.</p>
          </>
        )}

        {formData.orderType === 'rental' && (
          <p className="text-xs text-gray-600">Rental equipment comes with Magena Pilates standard finish and branding.</p>
        )}
      </div>

      {/* Business Information — rental only */}
      {formData.orderType === 'rental' && (
        <div className="border-t pt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-4">
            <p className="text-sm text-blue-900">
              <strong>Commercial Use Only:</strong> Rentals are only available for businesses with a physical studio, gym, or commercial fitness facility. Not available for home/residential use.
            </p>
          </div>
          <h3 className="font-medium text-[#3D3530]">Business Information</h3>
          <div>
            <Label htmlFor="business_name" className="text-[#3D3530]">Business / Studio Name *</Label>
            <Input id="business_name" required value={formData.businessName}
              onChange={(e) => set({ businessName: e.target.value })}
              className="mt-1" placeholder="e.g., Wellness Studio Nairobi" />
          </div>
          <div>
            <Label htmlFor="business_type" className="text-[#3D3530]">Business Type *</Label>
            <Select value={formData.businessType} onValueChange={(v) => set({ businessType: v })}>
              <SelectTrigger id="business_type" className="mt-1">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="business_reg" className="text-[#3D3530]">Business Registration Number *</Label>
            <Input id="business_reg" required value={formData.businessRegistrationNumber}
              onChange={(e) => set({ businessRegistrationNumber: e.target.value })}
              className="mt-1" placeholder="Company registration or business permit number" />
          </div>
          <div>
            <Label htmlFor="business_address" className="text-[#3D3530]">Business Physical Address *</Label>
            <Textarea id="business_address" required value={formData.businessAddress}
              onChange={(e) => set({ businessAddress: e.target.value })}
              className="mt-1" rows={3}
              placeholder="Full physical address of your studio/gym" />
            <p className="text-xs text-gray-600 mt-1">Equipment must remain at this address during rental period.</p>
          </div>
        </div>
      )}

      {/* Contact Information */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-medium text-[#3D3530]">
          {formData.orderType === 'rental' ? 'Contact Person Information' : 'Customer Information'}
        </h3>
        <div>
          <Label htmlFor="name" className="text-[#3D3530]">
            {formData.orderType === 'rental' ? 'Contact Person Full Name *' : 'Full Name *'}
          </Label>
          <Input id="name" required value={formData.customerName}
            onChange={(e) => set({ customerName: e.target.value })}
            className="mt-1" placeholder="John Doe" />
        </div>
        <div>
          <Label htmlFor="email" className="text-[#3D3530]">Email Address *</Label>
          <Input id="email" type="email" required value={formData.customerEmail}
            onChange={(e) => set({ customerEmail: e.target.value })}
            className="mt-1" placeholder="john@example.com" />
        </div>
        <div>
          <Label htmlFor="phone" className="text-[#3D3530]">Phone Number *</Label>
          <Input id="phone" type="tel" required value={formData.customerPhone}
            onChange={(e) => set({ customerPhone: e.target.value })}
            className="mt-1" placeholder="+254712345678" />
          <p className="text-xs text-gray-600 mt-1">Include country code (e.g., +254 for Kenya)</p>
        </div>
        <div>
          <Label htmlFor="whatsapp" className="text-[#3D3530]">WhatsApp Number (if different from phone)</Label>
          <Input id="whatsapp" type="tel" value={formData.whatsappNumber}
            onChange={(e) => set({ whatsappNumber: e.target.value })}
            className="mt-1" placeholder="+254712345678" />
        </div>

        {/* Country with search */}
        <div>
          <Label htmlFor="country" className="text-[#3D3530]">Country *</Label>
          <Select value={formData.customerCountry} onValueChange={handleCountryChange}>
            <SelectTrigger id="country" className="mt-1">
              <SelectValue placeholder="Select your country..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 pb-2 sticky top-0 bg-white border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full h-8 pl-7 pr-3 border border-gray-300 rounded text-sm focus:outline-none"
                  />
                </div>
              </div>
              {filteredCountries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCountry && (
            <p className="text-xs text-gray-500 mt-1">
              {taxLabel}: {selectedCountry.vat_rate}%
              {selectedCountry.delivery_timeline ? ` · Delivery: ${selectedCountry.delivery_timeline}` : ''}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="city_town" className="text-[#3D3530]">City / Town *</Label>
          <Input id="city_town" required value={formData.cityTown}
            onChange={(e) => set({ cityTown: e.target.value })}
            className="mt-1" placeholder="e.g., Nairobi" />
        </div>
        <div>
          <Label htmlFor="address" className="text-[#3D3530]">Delivery Address *</Label>
          <Textarea id="address" required value={formData.customerAddress}
            onChange={(e) => set({ customerAddress: e.target.value })}
            className="mt-1" rows={3}
            placeholder="Enter your full delivery address" />
        </div>
      </div>

      {/* Notes */}
      <div className="border-t pt-4">
        <Label htmlFor="notes" className="text-[#3D3530]">Anything else we should know? (Optional)</Label>
        <Textarea id="notes" value={formData.notes}
          onChange={(e) => set({ notes: e.target.value.slice(0, 200) })}
          className="mt-1" rows={3}
          placeholder="Any special requests, delivery instructions, or questions..." />
        <p className="text-xs text-gray-600 mt-1">{formData.notes.length}/200 characters</p>
      </div>

      {/* Payment Method */}
      <div>
        <Label className="text-[#3D3530] mb-2 block">Payment Method *</Label>
        <RadioGroup
          value={formData.paymentMethod}
          onValueChange={(v) => set({ paymentMethod: v as 'mpesa' | 'card' })}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
            <RadioGroupItem value="mpesa" id="mpesa" />
            <Label htmlFor="mpesa" className="cursor-pointer flex-1">
              <span className="font-medium">M-PESA</span>
              <div className="text-xs text-gray-600 mt-1">Pay via M-PESA Paybill</div>
            </Label>
          </div>
          <div className="flex items-center space-x-2 border border-gray-300 p-3 hover:bg-gray-50">
            <RadioGroupItem value="card" id="card" />
            <Label htmlFor="card" className="cursor-pointer flex-1">
              <span className="font-medium">Card Payment</span>
              <div className="text-xs text-gray-600 mt-1">Visa, Mastercard, Verve · International cards · Powered by Paystack</div>
            </Label>
          </div>
        </RadioGroup>
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
            <span>{formData.orderType === 'purchase' ? 'Buy Price:' : 'Monthly Rental:'}</span>
            <span className="font-medium">
              {currencySymbol} {(formData.orderType === 'purchase'
                ? (convertedPrices.purchasePrice || 0) * quantity
                : (convertedPrices.rentalPrice || 0) * quantity
              ).toLocaleString()}
            </span>
          </div>
          {formData.wantsEngraving && (
            <div className="flex justify-between">
              <span>Personal Engraving:</span>
              <span className="font-medium">{currencySymbol} {(convertedEngravingValue * quantity).toLocaleString()}</span>
            </div>
          )}
          {getVAT() > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span>{currencySymbol} {getSubtotal().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{taxLabel} ({vatPercent}%):</span>
                <span>{currencySymbol} {getVAT().toLocaleString()}</span>
              </div>
            </>
          )}
          {getDeposit() > 0 && (
            <div className="flex justify-between">
              <span>Refundable Deposit:</span>
              <span className="font-medium">{currencySymbol} {getDeposit().toLocaleString()}</span>
            </div>
          )}
          {quantity <= 2 && selectedCountry?.delivery_timeline && (
            <div className="flex justify-between text-sm text-gray-600 border-t pt-2 mt-2">
              <span>Estimated Delivery:</span>
              <span className="font-medium">{selectedCountry.delivery_timeline}</span>
            </div>
          )}
          {quantity > 2 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm mt-2">
              <p className="text-amber-900">
                <strong>Bulk Order Notice:</strong> You're ordering {quantity} equipment. Since each piece is handcrafted to order, delivery timeline will be confirmed after your order is placed. You will receive confirmation via email, WhatsApp, and SMS once your equipment is ready for delivery.
              </p>
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

      <button type="submit" className="w-full bg-[#3D3530] text-white py-4 text-lg hover:bg-[#2D2520] transition-colors">
        Place Order
      </button>
    </form>
  );
}
