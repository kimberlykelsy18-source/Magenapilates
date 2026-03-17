import { useState, useEffect } from 'react';
import { Product, SiteSettings } from '../types';
import { storage } from '../utils/storage';
import { initialProducts } from '../data/initialProducts';
import { PreOrderForm } from '../components/PreOrderForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Minus, Plus, Globe } from 'lucide-react';
import { Currency, currencies, convertPrice, formatPrice } from '../utils/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import logoImg from 'figma:asset/053cd6f353a6bc54a9e76207dbf8b76552b71b53.png';

export function CustomerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(storage.getSettings());
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('KES');

  useEffect(() => {
    // Check data version and refresh if needed
    if (!storage.isDataVersionCurrent()) {
      storage.refreshData();
    }
    
    // Clear old data and use fresh initial products
    storage.saveProducts(initialProducts);
    const storedProducts = initialProducts;
    setProducts(storedProducts);
    
    // Initialize quantities
    const initialQuantities: Record<string, number> = {};
    storedProducts.forEach(p => {
      initialQuantities[p.id] = 1;
    });
    setQuantities(initialQuantities);
    
    // Load settings
    setSettings(storage.getSettings());
  }, []);

  const handleOrderClick = (product: Product) => {
    setSelectedProduct(product);
    setShowForm(true);
  };

  const updateQuantity = (productId: string, newQty: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, newQty)
    }));
  };

  return (
    <div className="min-h-screen bg-[#EBE6DD]">
      {/* Header */}
      <header className="bg-[#EBE6DD] border-b border-[#3D3530] py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <img src={logoImg} alt="Magena Pilates" className="h-16 mx-auto mb-2" />
          <p className="text-sm text-[#3D3530]">Pre-Order Equipment</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Pre-order Terms */}
        <div className="bg-white border border-[#3D3530] p-6 mb-8">
          <h2 className="text-lg mb-3 text-[#3D3530]">PRE-ORDER TERMS</h2>
          <div className="space-y-3 text-sm text-[#3D3530]">
            {settings.terms.map((term, index) => (
              <p key={index}>• {term}</p>
            ))}
          </div>
        </div>

        {/* Currency Selector */}
        <div className="mb-6 bg-white border border-[#3D3530] p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-[#3D3530]" />
            <label className="text-sm text-[#3D3530] font-medium">Currency:</label>
            <Select value={selectedCurrency} onValueChange={(value) => setSelectedCurrency(value as Currency)}>
              <SelectTrigger className="w-64 border-[#3D3530]">
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
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{currencies[key].code}</span>
                      <span className="text-sm text-gray-600 ml-2">{currencies[key].country}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products List */}
        <div className="space-y-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white border border-[#3D3530]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Product Image */}
                <div className="md:col-span-1">
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Image failed to load:', product.imageUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Product Details */}
                <div className="md:col-span-2 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl text-[#3D3530]">{product.name}</h3>
                    {product.status === 'coming-soon' && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 border border-yellow-300">
                        COMING SOON
                      </span>
                    )}
                  </div>

                  {product.description && (
                    <p className="text-sm text-[#3D3530] mb-4">{product.description}</p>
                  )}

                  {product.status === 'available' ? (
                    <>
                      <div className="space-y-2 mb-6 text-[#3D3530]">
                        {product.purchasePrice && (
                          <div className="flex justify-between border-b pb-2">
                            <span>Purchase Price:</span>
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
                          </>
                        )}
                      </div>

                      {/* Quantity Selector */}
                      <div className="mb-4">
                        <label className="block text-sm text-[#3D3530] mb-2">Quantity:</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const newQty = Math.max(1, quantities[product.id] - 1);
                              updateQuantity(product.id, newQty);
                            }}
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
                        className="w-full bg-[#3D3530] text-white py-3 hover:bg-[#2D2520] transition-colors"
                      >
                        ORDER NOW
                      </button>
                    </>
                  ) : (
                    <p className="text-[#3D3530] text-sm">This equipment will be available soon. Check back later!</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Pre-order Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#3D3530]">Complete Your Order</DialogTitle>
            <DialogDescription className="text-sm text-[#3D3530]">Please fill in the details to complete your order.</DialogDescription>
          </DialogHeader>
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
                setQuantities(prev => ({
                  ...prev,
                  [selectedProduct.id]: 1
                }));
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}