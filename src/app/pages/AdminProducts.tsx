import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Plus, Upload, Trash2 } from 'lucide-react';
import { adminHeaders } from './AdminDashboard';

import { API_URL as API } from '../utils/config';

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  purchase_price?: number;
  rental_price?: number;
  rental_deposit?: number;
  usd_price?: number;
  has_height_sizing?: boolean;
  status: 'available' | 'coming-soon';
}

type FormData = Omit<Product, 'id'>;

const EMPTY_FORM: FormData = {
  name: '', description: '', image_url: '',
  purchase_price: undefined, rental_price: undefined, rental_deposit: undefined,
  usd_price: undefined, has_height_sizing: false, status: 'available',
};

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`);
      if (!res.ok) throw new Error('Failed to load products');
      setProducts(await res.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const resetForm = () => { setFormData(EMPTY_FORM); setEditingProduct(null); setImagePreview(''); };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name, description: p.description || '', image_url: p.image_url || '',
      purchase_price: p.purchase_price, rental_price: p.rental_price, rental_deposit: p.rental_deposit,
      usd_price: p.usd_price, has_height_sizing: p.has_height_sizing || false, status: p.status,
    });
    setImagePreview(p.image_url || '');
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize to max 900px before uploading to keep storage small
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 900;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const b64 = canvas.toDataURL('image/jpeg', 0.82);

      setImagePreview(b64);
      setSaving(true);
      try {
        const res = await fetch(`${API}/api/admin/upload`, {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ image: b64, filename: file.name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setFormData((prev) => ({ ...prev, image_url: data.url }));
        toast.success('Image uploaded');
      } catch (err: any) {
        toast.error(err.message);
        setImagePreview('');
      } finally {
        setSaving(false);
      }
    };
    img.src = objectUrl;
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeletingId(product.id);
    try {
      const res = await fetch(`${API}/api/admin/products/${product.id}`, { method: 'DELETE', headers: adminHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Product deleted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      const body = JSON.stringify(formData);
      if (editingProduct) {
        const res = await fetch(`${API}/api/admin/products/${editingProduct.id}`, { method: 'PUT', headers: adminHeaders(), body });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
        toast.success('Product updated');
      } else {
        const res = await fetch(`${API}/api/admin/products`, { method: 'POST', headers: adminHeaders(), body });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
        toast.success('Product added');
      }
      await loadProducts();
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-gray-500">Loading products...</div>;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl">Products</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#3D3530] text-white hover:bg-[#2D2520]">
          <Plus className="h-4 w-4 mr-2" />Add Product
        </Button>
      </div>

      <div className="space-y-4">
        {products.map((product) => (
          <div key={product.id} className="border p-4 bg-white rounded">
            <div className="flex gap-4">
              <div className="w-28 h-28 bg-gray-100 flex-shrink-0 rounded overflow-hidden">
                {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-lg text-[#3D3530]">{product.name}</h3>
                  <div className="flex items-center gap-2">
                    {product.has_height_sizing && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">Height Sizing</span>}
                    <span className={`text-xs px-2 py-0.5 rounded ${product.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{product.status}</span>
                  </div>
                </div>
                {product.description && <p className="text-sm text-gray-600 mb-2">{product.description}</p>}
                <div className="grid grid-cols-4 gap-3 text-sm mb-3">
                  {product.purchase_price && <div><div className="text-xs text-gray-500">KES Purchase</div><div className="font-medium">KES {Number(product.purchase_price).toLocaleString()}</div></div>}
                  {product.usd_price && <div><div className="text-xs text-gray-500">USD Purchase</div><div className="font-medium">$ {Number(product.usd_price).toLocaleString()}</div></div>}
                  {product.rental_price && <div><div className="text-xs text-gray-500">Rental/Month</div><div className="font-medium">KES {Number(product.rental_price).toLocaleString()}</div></div>}
                  {product.rental_deposit && <div><div className="text-xs text-gray-500">Deposit</div><div className="font-medium">KES {Number(product.rental_deposit).toLocaleString()}</div></div>}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleEdit(product)} variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                  <Button onClick={() => handleDelete(product)} variant="outline" size="sm" disabled={deletingId === product.id}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>{editingProduct ? 'Edit the product details.' : 'Add a new Pilates product.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 px-1 py-2">
            <div><Label htmlFor="name">Product Name *</Label>
              <Input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            <div><Label htmlFor="image_url">Image URL</Label>
              <Input id="image_url" type="url" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} placeholder="https://..." /></div>
            <div>
              <Label>Or Upload Image</Label>
              <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-gray-400">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="imageUpload" />
                <label htmlFor="imageUpload" className="cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <p className="text-xs text-gray-600">Click to upload</p>
                </label>
              </div>
              {imagePreview && <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover rounded mt-2" />}
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="coming-soon">Coming Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="has_height_sizing" checked={formData.has_height_sizing || false}
                onChange={(e) => setFormData({ ...formData, has_height_sizing: e.target.checked })}
                className="w-4 h-4 accent-[#3D3530]" />
              <Label htmlFor="has_height_sizing">Has Height Sizing (for barrels)</Label>
            </div>
            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#3D3530]">Pricing</h3>
              <div><Label htmlFor="purchase_price">Purchase Price (KES)</Label>
                <Input id="purchase_price" type="number" min="0" value={formData.purchase_price || ''}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
              <div><Label htmlFor="usd_price">USD Price</Label>
                <Input id="usd_price" type="number" min="0" step="0.01" value={formData.usd_price || ''}
                  onChange={(e) => setFormData({ ...formData, usd_price: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
              <div><Label htmlFor="rental_price">Monthly Rental (KES)</Label>
                <Input id="rental_price" type="number" min="0" value={formData.rental_price || ''}
                  onChange={(e) => setFormData({ ...formData, rental_price: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
              <div><Label htmlFor="rental_deposit">Rental Deposit (KES)</Label>
                <Input id="rental_deposit" type="number" min="0" value={formData.rental_deposit || ''}
                  onChange={(e) => setFormData({ ...formData, rental_deposit: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-[#3D3530] text-white hover:bg-[#2D2520] disabled:opacity-60">
              {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
