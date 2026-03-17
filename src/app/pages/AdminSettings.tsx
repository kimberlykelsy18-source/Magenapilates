import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { SiteSettings } from '../types';
import { Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings>(storage.getSettings());
  const [newTerm, setNewTerm] = useState('');

  useEffect(() => {
    setSettings(storage.getSettings());
  }, []);

  const handleSave = () => {
    storage.saveSettings(settings);
    toast.success('Settings updated successfully');
  };

  const addTerm = () => {
    if (newTerm.trim()) {
      setSettings({
        ...settings,
        terms: [...settings.terms, newTerm.trim()]
      });
      setNewTerm('');
    }
  };

  const removeTerm = (index: number) => {
    setSettings({
      ...settings,
      terms: settings.terms.filter((_, i) => i !== index)
    });
  };

  const updateTerm = (index: number, value: string) => {
    const updatedTerms = [...settings.terms];
    updatedTerms[index] = value;
    setSettings({
      ...settings,
      terms: updatedTerms
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl text-[#3D3530]">Site Settings</h2>
        <button
          onClick={handleSave}
          className="bg-[#3D3530] text-white px-4 py-2 hover:bg-[#2D2520] flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save Changes
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

          {/* Add New Term */}
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
          <label className="block text-sm mb-2 text-[#3D3530]">
            Engraving Price (KES)
          </label>
          <input
            type="number"
            value={settings.engravingPrice}
            onChange={(e) => setSettings({ ...settings, engravingPrice: Number(e.target.value) })}
            className="w-full border border-gray-300 px-3 py-2"
            min="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Price charged for logo engraving after pre-order period ends
          </p>
        </div>

        {/* Rental Fixed Months */}
        <div>
          <label className="block text-sm mb-2 text-[#3D3530]">
            Rental Fixed Price Period (Months)
          </label>
          <input
            type="number"
            value={settings.rentalFixedMonths}
            onChange={(e) => setSettings({ ...settings, rentalFixedMonths: Number(e.target.value) })}
            className="w-full border border-gray-300 px-3 py-2"
            min="1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Number of months pre-order rental price remains fixed
          </p>
        </div>
      </div>
    </div>
  );
}
