import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Product, SiteSettings } from '../types';
import { storage } from '../utils/storage';
import { initialProducts } from '../data/initialProducts';
import { PreOrderForm } from '../components/PreOrderForm';
import { IntroAnimation } from '../components/IntroAnimation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Minus, Plus, Globe, Clock, Instagram } from 'lucide-react';
import { Currency, currencies, convertPrice, formatPrice } from '../utils/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import logoImg from '../../assets/magena-logo-stacked-dark.svg';
import customerBg from '../../assets/customer_page_bg.png';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

function mapApiProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.image_url || '',
    purchasePrice: p.purchase_price ? Number(p.purchase_price) : undefined,
    rentalPrice: p.rental_price ? Number(p.rental_price) : undefined,
    rentalDeposit: p.rental_deposit ? Number(p.rental_deposit) : undefined,
    usdPrice: p.usd_price ? Number(p.usd_price) : undefined,
    hasHeightSizing: p.has_height_sizing || false,
    leatherFinishes: p.leather_finishes || [],
    woodFinishes: p.wood_finishes || [],
    status: p.status,
  };
}

function mapApiSettings(s: any): SiteSettings {
  return {
    terms: s.terms || [],
    engravingPrice: s.engraving_price ?? 3500,
    rentalFixedMonths: s.rental_fixed_months ?? 5,
    exchangeRate: s.exchange_rate,
    instagramUrl: s.instagram_url,
    pinterestUrl: s.pinterest_url,
    whatsappNumber: s.whatsapp_number,
    footerDisclaimer: s.footer_disclaimer,
    postOrderMessage: s.post_order_message,
    waitlistMessage: s.waitlist_message,
    leatherFinishes: s.leather_finishes || [],
    woodFinishes: s.wood_finishes || [],
  };
}

const PinterestIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export function CustomerPage() {
  const [showIntro, setShowIntro] = useState(() => sessionStorage.getItem('mp_intro_seen') !== '1');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(storage.getSettings());
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('KES');

  const handleIntroComplete = () => {
    sessionStorage.setItem('mp_intro_seen', '1');
    setShowIntro(false);
  };

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapApiProduct);
          setProducts(mapped);
          const qs: Record<string, number> = {};
          mapped.forEach((p) => { qs[p.id] = 1; });
          setQuantities(qs);
        } else {
          throw new Error('empty');
        }
      })
      .catch(() => {
        setProducts(initialProducts);
        const qs: Record<string, number> = {};
        initialProducts.forEach((p) => { qs[p.id] = 1; });
        setQuantities(qs);
      });

    fetch(`${API}/api/settings`)
      .then((r) => r.json())
      .then((data) => { if (data && !data.error) setSettings(mapApiSettings(data)); })
      .catch(() => { setSettings(storage.getSettings()); });
  }, []);

  const handleOrderClick = (product: Product) => {
    setSelectedProduct(product);
    setShowForm(true);
  };

  const updateQuantity = (productId: string, newQty: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(1, newQty) }));
  };

  const availableProducts = products.filter((p) => p.status === 'available');
  const comingSoonProducts = products.filter((p) => p.status === 'coming-soon');
  const hasComingSoon = comingSoonProducts.length > 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundImage: `url(${customerBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}
    >
      {/* Header */}
      <header className="bg-[#EBE6DD] border-b border-[#3D3530] py-6">
        <div className="max-w-6xl mx-auto px-4">
          {/* Logo row: spacer | centered logo | social icons right */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1" />
            <img src={logoImg} alt="Magena Pilates" className="h-16" />
            <div className="flex-1 flex justify-end gap-3 pt-2">
              <a
                href={settings.instagramUrl || 'https://instagram.com/magenapilates'}
                target="_blank" rel="noopener noreferrer"
                className="text-[#3D3530] hover:opacity-70 transition-opacity" aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href={settings.pinterestUrl || 'https://pinterest.com/magenapilates'}
                target="_blank" rel="noopener noreferrer"
                className="text-[#3D3530] hover:opacity-70 transition-opacity" aria-label="Pinterest"
              >
                <PinterestIcon />
              </a>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex justify-center gap-6">
            <Link to="/" className="text-sm text-[#3D3530] font-medium underline">
              Order Equipment
            </Link>
            <Link to="/waitlist" className="text-sm text-[#3D3530] hover:underline">
              Join Waitlist
            </Link>
            <Link to="/order-status" className="text-sm text-[#3D3530] hover:underline">
              Check Order Status
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8" id="products">

        {/* Currency Selector */}
        <div className="mb-6 bg-white border border-[#3D3530] p-4">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-[#3D3530] shrink-0" />
              <label className="text-sm text-[#3D3530] font-medium shrink-0">Currency:</label>
              <Select value={selectedCurrency} onValueChange={(value) => setSelectedCurrency(value as Currency)}>
                <SelectTrigger className="w-52 border-[#3D3530]">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{currencies[selectedCurrency].code}</span>
                      <span className="text-sm text-gray-600">- {currencies[selectedCurrency].country}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(currencies) as Currency[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currencies[key].code}</span>
                        <span className="text-sm text-gray-600">{currencies[key].country}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 italic">
              KES prices inclusive of VAT · USD prices VAT exclusive · Rentals: Kenya only (commercial use)
            </p>
          </div>
        </div>

        {/* Pre-order Terms */}
        {settings.terms.length > 0 && (
          <div className="bg-white border border-[#3D3530] p-6 mb-8">
            <h2 className="text-lg mb-3 text-[#3D3530]">PRE-ORDER TERMS</h2>
            <div className="space-y-3 text-sm text-[#3D3530]">
              {settings.terms.map((term, index) => (
                <p key={index}>• {term}</p>
              ))}
            </div>
          </div>
        )}

        {/* Available Products */}
        <div className="space-y-6">
          {availableProducts.map((product) => (
            <div key={product.id} className="bg-white border border-[#3D3530]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Image */}
                <div className="md:col-span-1">
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="md:col-span-2 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl text-[#3D3530]">{product.name}</h3>
                  </div>

                  {product.description && (
                    <p className="text-sm text-[#3D3530] mb-4">{product.description}</p>
                  )}

                  <div className="space-y-2 mb-6 text-[#3D3530]">
                    {product.purchasePrice && (
                      <div className="flex justify-between border-b pb-2">
                        <span>Buy Price:</span>
                        <span className="font-medium">{formatPrice(convertPrice(product.purchasePrice, selectedCurrency), selectedCurrency)}</span>
                      </div>
                    )}
                    {product.rentalPrice && (
                      <>
                        <div className="flex justify-between border-b pb-2">
                          <span>Monthly Rental:</span>
                          <span className="font-medium">{formatPrice(convertPrice(product.rentalPrice, selectedCurrency), selectedCurrency)}/month</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span>Rental Deposit:</span>
                          <span className="font-medium">{formatPrice(convertPrice(product.rentalDeposit || 0, selectedCurrency), selectedCurrency)}</span>
                        </div>
                        <p className="text-xs text-amber-700">Rentals are available in Kenya only.</p>
                      </>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="mb-4">
                    <label className="block text-sm text-[#3D3530] mb-2">Quantity:</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(product.id, quantities[product.id] - 1)}
                        className="border border-[#3D3530] p-2 hover:bg-gray-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-lg font-medium w-12 text-center">{quantities[product.id]}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantities[product.id] + 1)}
                        className="border border-[#3D3530] p-2 hover:bg-gray-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOrderClick(product)}
                    className="w-full bg-[#3D3530] text-white py-3 hover:bg-[#2D2520] transition-colors uppercase tracking-widest text-sm"
                  >
                    ORDER NOW
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Section */}
        {hasComingSoon && (
          <div className="mt-10 bg-[#3D3530] text-[#EBE6DD] p-8 text-center">
            <p className="text-xs tracking-[4px] uppercase text-[#EBE6DD]/60 mb-2">Coming Soon</p>
            <h2 className="text-2xl mb-4">
              {comingSoonProducts.map((p) => p.name).join(' & ')}
            </h2>
            <p className="text-sm text-[#EBE6DD]/80 max-w-md mx-auto mb-6">
              We're working on the {comingSoonProducts.map((p) => p.name).join(' and ')}.
              Join our waitlist to be notified when they're ready.
            </p>
            <Link
              to="/waitlist"
              className="inline-flex items-center gap-2 border border-[#EBE6DD] text-[#EBE6DD] px-6 py-3 text-sm uppercase tracking-widest hover:bg-[#EBE6DD] hover:text-[#3D3530] transition-colors"
            >
              <Clock className="h-4 w-4" />
              Join the Waitlist
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#3D3530] text-[#EBE6DD] py-8 mt-auto">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <img src={logoImg} alt="Magena Pilates" className="h-12 mx-auto md:mx-0 mb-2" style={{ filter: 'brightness(0) invert(1)' }} />
              {settings.footerDisclaimer && (
                <p className="text-xs text-[#EBE6DD]/70 max-w-xs">{settings.footerDisclaimer}</p>
              )}
            </div>
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex items-center gap-4">
                {settings.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#EBE6DD]/80 hover:text-white transition-colors" aria-label="Instagram">
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {settings.pinterestUrl && (
                  <a href={settings.pinterestUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#EBE6DD]/80 hover:text-white transition-colors" aria-label="Pinterest">
                    <PinterestIcon />
                  </a>
                )}
                {settings.whatsappNumber && (
                  <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[#EBE6DD]/80 hover:text-white transition-colors" aria-label="WhatsApp">
                    <WhatsAppIcon />
                  </a>
                )}
              </div>
              <div className="flex gap-4 text-xs text-[#EBE6DD]/70">
                <Link to="/order-status" className="hover:text-white transition-colors">Track Your Order</Link>
                <Link to="/waitlist" className="hover:text-white transition-colors">Join Waitlist</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-[#EBE6DD]/20 mt-6 pt-4 text-center text-xs text-[#EBE6DD]/50">
            © {new Date().getFullYear()} Magena Pilates. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Intro animation — full-screen overlay, plays once per session */}
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}

      {/* Pre-order Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[#3D3530]">Complete Your Order</DialogTitle>
            <DialogDescription className="text-sm text-[#3D3530]">Please fill in the details to complete your order.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {selectedProduct && (
              <PreOrderForm
                product={selectedProduct}
                quantity={quantities[selectedProduct.id]}
                selectedCurrency={currencies[selectedCurrency].code}
                currencySymbol={currencies[selectedCurrency].symbol}
                convertedPrices={{
                  purchasePrice: selectedProduct.purchasePrice ? convertPrice(selectedProduct.purchasePrice, selectedCurrency) : undefined,
                  rentalPrice: selectedProduct.rentalPrice ? convertPrice(selectedProduct.rentalPrice, selectedCurrency) : undefined,
                  rentalDeposit: selectedProduct.rentalDeposit ? convertPrice(selectedProduct.rentalDeposit, selectedCurrency) : undefined,
                }}
                onSuccess={() => {
                  setShowForm(false);
                  setQuantities((prev) => ({ ...prev, [selectedProduct.id]: 1 }));
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
