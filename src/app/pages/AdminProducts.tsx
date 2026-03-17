import { useState, useEffect } from 'react';
import { Product } from '../types';
import { storage } from '../utils/storage';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Plus, Upload } from 'lucide-react';

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    imageUrl: '',
    purchasePrice: undefined,
    rentalPrice: undefined,
    rentalDeposit: undefined,
    status: 'available',
  });

  const loadProducts = () => {
    setProducts(storage.getProducts());
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      imageUrl: '',
      purchasePrice: undefined,
      rentalPrice: undefined,
      rentalDeposit: undefined,
      status: 'available',
    });
    setEditingProduct(null);
    setImagePreview('');
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setImagePreview(product.imageUrl);
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setFormData({ ...formData, imageUrl: base64String });
        toast.success('Image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Product name is required');
      return;
    }

    let updatedProducts: Product[];

    if (editingProduct) {
      updatedProducts = products.map(p =>
        p.id === editingProduct.id ? { ...formData, id: p.id } as Product : p
      );
      toast.success('Product updated');
    } else {
      const newProduct: Product = {
        ...formData,
        id: Date.now().toString(),
      } as Product;
      updatedProducts = [...products, newProduct];
      toast.success('Product added');
    }

    storage.saveProducts(updatedProducts);
    loadProducts();
    setShowForm(false);
    resetForm();
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl">Products</h2>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-[#3D3530] text-white hover:bg-[#2D2520]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="space-y-4">
        {products.map((product) => (
          <div key={product.id} className="border p-4 bg-white">
            <div className="flex gap-4">
              <div className="w-32 h-32 bg-gray-100 flex-shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg">{product.name}</h3>
                  <span className={`text-xs px-2 py-1 ${
                    product.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {product.status}
                  </span>
                </div>

                {product.description && (
                  <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                  {product.purchasePrice && (
                    <div>
                      <div className="text-gray-600">Purchase</div>
                      <div>KES {product.purchasePrice.toLocaleString()}</div>
                    </div>
                  )}
                  {product.rentalPrice && (
                    <div>
                      <div className="text-gray-600">Rental/Month</div>
                      <div>KES {product.rentalPrice.toLocaleString()}</div>
                    </div>
                  )}
                  {product.rentalDeposit && (
                    <div>
                      <div className="text-gray-600">Deposit</div>
                      <div>KES {product.rentalDeposit.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleEdit(product)}
                  variant="outline"
                  size="sm"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Edit the product details below.' : 'Add a new product to the inventory.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter product description..."
              />
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://... or figma:asset/..."
              />
            </div>

            <div>
              <Label>Or Upload Image</Label>
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="imageUpload"
                  />
                  <label htmlFor="imageUpload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Click to upload image</p>
                    <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB</p>
                  </label>
                </div>
                {imagePreview && (
                  <div className="border rounded p-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="coming-soon">Coming Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-3">Pricing</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="purchasePrice">Purchase Price (KES)</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    value={formData.purchasePrice || ''}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>

                <div>
                  <Label htmlFor="rentalPrice">Monthly Rental (KES)</Label>
                  <Input
                    id="rentalPrice"
                    type="number"
                    min="0"
                    value={formData.rentalPrice || ''}
                    onChange={(e) => setFormData({ ...formData, rentalPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>

                <div>
                  <Label htmlFor="rentalDeposit">Rental Deposit (KES)</Label>
                  <Input
                    id="rentalDeposit"
                    type="number"
                    min="0"
                    value={formData.rentalDeposit || ''}
                    onChange={(e) => setFormData({ ...formData, rentalDeposit: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="bg-[#3D3530] text-white hover:bg-[#2D2520]">
                {editingProduct ? 'Update' : 'Add'} Product
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}