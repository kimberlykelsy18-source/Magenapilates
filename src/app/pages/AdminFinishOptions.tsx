import { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Palette, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

import { API_URL as API } from '../utils/config';

interface FinishItem {
  name: string;
  imageUrl?: string | null;
}

interface Finishes {
  leather: FinishItem[];
  wood: FinishItem[];
}

/** Resize an image file to max 220×220 JPEG before storing as base64. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 220;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface FinishSectionProps {
  title: string;
  subtitle: string;
  items: FinishItem[];
  onUpdate: (items: FinishItem[]) => void;
  addPlaceholder: string;
  addLabel: string;
}

function FinishSection({ title, subtitle, items, onUpdate, addPlaceholder, addLabel }: FinishSectionProps) {
  const [newName, setNewName] = useState('');
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleImageUpload = async (i: number, file: File) => {
    try {
      const dataUrl = await resizeImage(file);
      onUpdate(items.map((item, idx) => idx === i ? { ...item, imageUrl: dataUrl } : item));
    } catch {
      toast.error('Failed to process image');
    }
  };

  const handleRemoveImage = (i: number) => {
    onUpdate(items.map((item, idx) => idx === i ? { ...item, imageUrl: null } : item));
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (items.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A finish with that name already exists');
      return;
    }
    onUpdate([...items, { name, imageUrl: null }]);
    setNewName('');
  };

  const handleDelete = (i: number) => {
    onUpdate(items.filter((_, idx) => idx !== i));
  };

  return (
    <div className="bg-white border border-gray-200 p-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-5">{subtitle}</p>

      <div className="space-y-2 mb-5">
        {items.length === 0 && (
          <p className="text-sm text-gray-400 italic py-2">No finish options added yet.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
            {/* Thumbnail */}
            <div className="w-10 h-10 border border-gray-200 flex-shrink-0 overflow-hidden bg-gray-50 flex items-center justify-center">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-4 w-4 text-gray-300" />
              )}
            </div>

            {/* Name */}
            <span className="flex-1 text-sm text-[#3D3530] font-medium">{item.name}</span>

            {/* Actions */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={(el) => { fileRefs.current[i] = el; }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(i, file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileRefs.current[i]?.click()}
              className="text-xs border border-gray-300 px-2.5 py-1 text-gray-600 hover:border-[#3D3530] hover:text-[#3D3530] whitespace-nowrap">
              {item.imageUrl ? 'Change Image' : 'Upload Image'}
            </button>
            {item.imageUrl && (
              <button onClick={() => handleRemoveImage(i)}
                className="text-xs text-gray-400 hover:text-red-500 whitespace-nowrap">
                Remove
              </button>
            )}
            <button onClick={() => handleDelete(i)} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2 max-w-sm">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={addPlaceholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]"
        />
        <button onClick={handleAdd}
          className="bg-[#3D3530] text-white px-3 py-2 text-sm hover:bg-[#2D2520] flex items-center gap-1 whitespace-nowrap">
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </div>
    </div>
  );
}

export function AdminFinishOptions() {
  const [finishes, setFinishes] = useState<Finishes>({
    leather: [
      { name: 'Black' }, { name: 'Tan' }, { name: 'Cream' }, { name: 'Olive' }, { name: 'Custom' },
    ],
    wood: [
      { name: 'Natural Oil' }, { name: 'Dark Walnut Stain' }, { name: 'Ebony' }, { name: 'Custom' },
    ],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/settings/finishes`, { headers: adminHeaders() })
      .then((r) => r.json())
      .then((f) => {
        setFinishes({
          leather: f.leather_finishes || [],
          wood: f.wood_finishes || [],
        });
      })
      .catch(() => toast.error('Failed to load finish options'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings/finishes`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          leather_finishes: finishes.leather,
          wood_finishes: finishes.wood,
        }),
      });
      if (!res.ok) throw new Error('Failed to save finish options');
      const updated = await res.json();
      setFinishes({ leather: updated.leather_finishes, wood: updated.wood_finishes });
      toast.success('Finish options saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-gray-500">Loading finish options...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl text-[#3D3530] flex items-center gap-2">
          <Palette className="h-6 w-6" />
          Finish Options Management
        </h2>
        <button onClick={handleSave} disabled={saving}
          className="bg-[#3D3530] text-white px-4 py-2 text-sm hover:bg-[#2D2520] flex items-center gap-2 disabled:opacity-60">
          <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-6">
        <FinishSection
          title="Leather Finish Options"
          subtitle="Available choices shown to customers on purchase orders"
          items={finishes.leather}
          onUpdate={(items) => setFinishes({ ...finishes, leather: items })}
          addPlaceholder="Finish name (e.g., Navy Blue)"
          addLabel="Add Leather Finish"
        />
        <FinishSection
          title="Wood Finishing Options"
          subtitle="Available choices shown to customers on purchase orders"
          items={finishes.wood}
          onUpdate={(items) => setFinishes({ ...finishes, wood: items })}
          addPlaceholder="Finish name (e.g., Mahogany)"
          addLabel="Add Wood Finish"
        />
        <p className="text-xs text-gray-400">
          Images are resized to 220×220 px before saving. Finish names are shown to customers during checkout.
        </p>
      </div>
    </div>
  );
}
