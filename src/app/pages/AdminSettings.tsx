import { useState, useEffect } from 'react';
import { Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Settings {
  terms: string[];
  engraving_price: number;
  rental_fixed_months: number;
}

const DEFAULT_SETTINGS: Settings = {
  terms: [],
  engraving_price: 3500,
  rental_fixed_months: 5,
};

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTerm, setNewTerm] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/admin/settings`, { headers: adminHeaders() });
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        setSettings({
          terms: data.terms || [],
          engraving_price: data.engraving_price ?? 3500,
          rental_fixed_months: data.rental_fixed_months ?? 5,
        });
      } catch (err: any) {
        toast.error(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          terms: settings.terms,
          engraving_price: settings.engraving_price,
          rental_fixed_months: settings.rental_fixed_months,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Settings updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addTerm = () => {
    if (newTerm.trim()) {
      setSettings({ ...settings, terms: [...settings.terms, newTerm.trim()] });
      setNewTerm('');
    }
  };

  const removeTerm = (index: number) => {
    setSettings({ ...settings, terms: settings.terms.filter((_, i) => i !== index) });
  };

  const updateTerm = (index: number, value: string) => {
    const updated = [...settings.terms];
    updated[index] = value;
    setSettings({ ...settings, terms: updated });
  };

  if (loading) return <div className="py-16 text-center text-gray-500">Loading settings...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl text-[#3D3530]">Site Settings</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#3D3530] text-white px-4 py-2 hover:bg-[#2D2520] flex items-center gap-2 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white border border-gray-300 p-6 space-y-6">
        {/* Pre-order Terms */}
        <div>
          <h3 className="text-lg mb-4 text-[#3D3530]">Pre-Order Terms</h3>
          <div className="space-y-3 mb-4">
            {settings.terms.map((term, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={term}
                  onChange={(e) => updateTerm(index, e.target.value)}
                  className="flex-1 border border-gray-300 px-3 py-2"
                  placeholder="Enter term..."
                />
                <button
                  onClick={() => removeTerm(index)}
                  className="border border-red-500 text-red-500 px-3 py-2 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              className="flex-1 border border-gray-300 px-3 py-2"
              placeholder="Add new term..."
              onKeyDown={(e) => e.key === 'Enter' && addTerm()}
            />
            <button
              onClick={addTerm}
              className="bg-[#3D3530] text-white px-4 py-2 hover:bg-[#2D2520] flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Term
            </button>
          </div>
        </div>

        {/* Engraving Price */}
        <div>
          <label className="block text-sm mb-2 text-[#3D3530]">Engraving Price (KES)</label>
          <input
            type="number"
            value={settings.engraving_price}
            onChange={(e) => setSettings({ ...settings, engraving_price: Number(e.target.value) })}
            className="w-full border border-gray-300 px-3 py-2"
            min="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Price charged for logo engraving after the pre-order period ends
          </p>
        </div>

        {/* Rental Fixed Months */}
        <div>
          <label className="block text-sm mb-2 text-[#3D3530]">Rental Fixed Price Period (Months)</label>
          <input
            type="number"
            value={settings.rental_fixed_months}
            onChange={(e) => setSettings({ ...settings, rental_fixed_months: Number(e.target.value) })}
            className="w-full border border-gray-300 px-3 py-2"
            min="1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Number of months the pre-order rental price is fixed
          </p>
        </div>
      </div>
    </div>
  );
}
