import { useState, useEffect } from 'react';
import { Save, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

import { API_URL as API } from '../utils/config';

interface Product {
  id: string;
  name: string;
  purchase_price?: number;
  rental_price?: number;
  rental_deposit?: number;
  usd_price?: number;
}

interface PricingSettings {
  exchange_rate: number;
  engraving_price: number;
  rental_fixed_months: number;
}

export function AdminPricing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<PricingSettings>({ exchange_rate: 130, engraving_price: 3500, rental_fixed_months: 5 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productPrices, setProductPrices] = useState<Record<string, { usd_price?: number; purchase_price?: number; rental_price?: number; rental_deposit?: number }>>({});

  useEffect(() => {
    async function load() {
      try {
        const [prodRes, settRes] = await Promise.all([
          fetch(`${API}/api/products`),
          fetch(`${API}/api/admin/settings`, { headers: adminHeaders() }),
        ]);
        const prods = await prodRes.json();
        const sett = await settRes.json();
        setProducts(Array.isArray(prods) ? prods : []);
        setSettings({
          exchange_rate: sett.exchange_rate ?? 130,
          engraving_price: sett.engraving_price ?? 3500,
          rental_fixed_months: sett.rental_fixed_months ?? 5,
        });
        const prices: Record<string, any> = {};
        (Array.isArray(prods) ? prods : []).forEach((p: Product) => {
          prices[p.id] = {
            usd_price: p.usd_price,
            purchase_price: p.purchase_price,
            rental_price: p.rental_price,
            rental_deposit: p.rental_deposit,
          };
        });
        setProductPrices(prices);
      } catch {
        toast.error('Failed to load pricing data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Pricing settings saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async (productId: string) => {
    const prices = productPrices[productId];
    try {
      const res = await fetch(`${API}/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify(prices),
      });
      if (!res.ok) throw new Error('Failed to update product pricing');
      toast.success('Product pricing updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateProduct = (id: string, field: string, value: string) => {
    setProductPrices((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value === '' ? undefined : Number(value) },
    }));
  };

  if (loading) return <div className="py-16 text-center text-gray-500">Loading pricing...</div>;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl text-[#3D3530] flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Pricing Management
        </h2>
      </div>

      {/* Global Pricing Settings */}
      <div className="bg-white border border-gray-200 p-6 mb-6 rounded">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-4">Global Pricing Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Exchange Rate (KES per USD)</label>
            <input type="number" min="1" step="0.01"
              value={settings.exchange_rate}
              onChange={(e) => setSettings({ ...settings, exchange_rate: Number(e.target.value) })}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
            />
            <p className="text-xs text-gray-400 mt-1">Used to auto-calculate USD prices for international customers</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Engraving Price (KES)</label>
            <input type="number" min="0"
              value={settings.engraving_price}
              onChange={(e) => setSettings({ ...settings, engraving_price: Number(e.target.value) })}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
            />
            <p className="text-xs text-gray-400 mt-1">Charged for engraving after the pre-order period ends</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Minimum Rental Period (Months)</label>
            <input type="number" min="1"
              value={settings.rental_fixed_months}
              onChange={(e) => setSettings({ ...settings, rental_fixed_months: Number(e.target.value) })}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
            />
            <p className="text-xs text-gray-400 mt-1">Minimum rental commitment for commercial clients</p>
          </div>
        </div>
        <button onClick={handleSaveSettings} disabled={saving}
          className="flex items-center gap-2 bg-[#3D3530] text-white px-4 py-2 text-sm hover:bg-[#2D2520] disabled:opacity-60">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Per-product pricing */}
      <div className="space-y-4">
        {products.map((product) => {
          const prices = productPrices[product.id] || {};
          const autoUsd = settings.exchange_rate > 0 && prices.purchase_price
            ? (Number(prices.purchase_price) / settings.exchange_rate).toFixed(2)
            : null;

          return (
            <div key={product.id} className="bg-white border border-gray-200 p-5 rounded">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-[#3D3530]">{product.name}</h3>
                <button onClick={() => handleSaveProduct(product.id)}
                  className="flex items-center gap-1.5 bg-[#3D3530] text-white px-3 py-1.5 text-xs hover:bg-[#2D2520]">
                  <Save className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Purchase Price (KES)</label>
                  <input type="number" min="0" placeholder="0"
                    value={prices.purchase_price ?? ''}
                    onChange={(e) => updateProduct(product.id, 'purchase_price', e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    USD Price {autoUsd && <span className="text-gray-400">(auto: ${autoUsd})</span>}
                  </label>
                  <input type="number" min="0" step="0.01" placeholder={autoUsd || '0'}
                    value={prices.usd_price ?? ''}
                    onChange={(e) => updateProduct(product.id, 'usd_price', e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monthly Rental (KES)</label>
                  <input type="number" min="0" placeholder="0"
                    value={prices.rental_price ?? ''}
                    onChange={(e) => updateProduct(product.id, 'rental_price', e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rental Deposit (KES)</label>
                  <input type="number" min="0" placeholder="0"
                    value={prices.rental_deposit ?? ''}
                    onChange={(e) => updateProduct(product.id, 'rental_deposit', e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
