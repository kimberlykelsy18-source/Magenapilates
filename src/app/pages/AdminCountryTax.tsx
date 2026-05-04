import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

import { API_URL as API } from '../utils/config';

interface Country {
  id?: string;
  country_name: string;
  country_code: string;
  vat_rate: number;
  tax_label: string;
  delivery_timeline: string;
  currency_code: string;
  currency_name: string;
  rental_available: boolean;
}

const EMPTY: Omit<Country, 'id'> = {
  country_name: '', country_code: '', vat_rate: 0, tax_label: 'VAT',
  delivery_timeline: '', currency_code: '', currency_name: '', rental_available: false,
};

export function AdminCountryTax() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Country, 'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/country-tax`, { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to load countries');
      setCountries(await res.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = countries.filter((c) =>
    !search || c.country_name.toLowerCase().includes(search.toLowerCase()) || c.country_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (c: Country) => {
    setEditingCode(c.country_code);
    setForm({ country_name: c.country_name, country_code: c.country_code, vat_rate: c.vat_rate, tax_label: c.tax_label, delivery_timeline: c.delivery_timeline, currency_code: c.currency_code, currency_name: c.currency_name, rental_available: c.rental_available });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let res;
      if (editingCode) {
        res = await fetch(`${API}/api/admin/country-tax/${editingCode}`, {
          method: 'PUT', headers: adminHeaders(), body: JSON.stringify(form),
        });
      } else {
        res = await fetch(`${API}/api/admin/country-tax`, {
          method: 'POST', headers: adminHeaders(), body: JSON.stringify(form),
        });
      }
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      toast.success(editingCode ? 'Country updated' : 'Country added');
      setShowForm(false);
      setEditingCode(null);
      setForm(EMPTY);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      const res = await fetch(`${API}/api/admin/country-tax/${code}`, { method: 'DELETE', headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      setCountries((prev) => prev.filter((c) => c.country_code !== code));
      toast.success('Country removed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSeed = async () => {
    if (!confirm('This will add 40+ default countries. Existing entries will be updated. Continue?')) return;
    setSeeding(true);
    try {
      const res = await fetch(`${API}/api/admin/country-tax/seed`, { method: 'POST', headers: adminHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      toast.success(`Seeded ${data.count} countries`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl text-[#3D3530] flex items-center gap-2">
          <Globe className="h-6 w-6" /> Country Tax & Delivery ({countries.length})
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSeed} disabled={seeding}
            className="text-xs border border-[#3D3530] text-[#3D3530] px-3 py-2 hover:bg-[#3D3530] hover:text-white disabled:opacity-60">
            {seeding ? 'Seeding...' : 'Load 40+ Defaults'}
          </button>
          <button onClick={() => { setEditingCode(null); setForm(EMPTY); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-[#3D3530] text-white px-3 py-2 text-xs hover:bg-[#2D2520]">
            <Plus className="h-3.5 w-3.5" /> Add Country
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-[#3D3530] p-5 mb-6 rounded">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-[#3D3530]">{editingCode ? 'Edit Country' : 'Add Country'}</h3>
            <button onClick={() => { setShowForm(false); setEditingCode(null); setForm(EMPTY); }}>
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Country Name *</label>
              <input required value={form.country_name} onChange={(e) => setForm({ ...form, country_name: e.target.value })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" placeholder="Kenya" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Country Code *</label>
              <input required value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530] uppercase" placeholder="KE" maxLength={2} disabled={!!editingCode} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">VAT Rate (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={form.vat_rate}
                onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax Label</label>
              <input value={form.tax_label} onChange={(e) => setForm({ ...form, tax_label: e.target.value })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" placeholder="VAT / GST / IVA" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Timeline</label>
              <input value={form.delivery_timeline} onChange={(e) => setForm({ ...form, delivery_timeline: e.target.value })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" placeholder="4–6 weeks" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Currency Code</label>
              <input value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530] uppercase" placeholder="KES" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Currency Name</label>
              <input value={form.currency_name} onChange={(e) => setForm({ ...form, currency_name: e.target.value })}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" placeholder="Kenyan Shilling" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.rental_available}
                  onChange={(e) => setForm({ ...form, rental_available: e.target.checked })}
                  className="w-4 h-4 accent-[#3D3530]" />
                <span className="text-sm text-gray-700">Rental available in this country</span>
              </label>
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-[#3D3530] text-white px-4 py-2 text-sm hover:bg-[#2D2520] disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : (editingCode ? 'Update Country' : 'Add Country')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingCode(null); setForm(EMPTY); }}
                className="border border-gray-300 text-gray-600 px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search countries..."
            className="w-full border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500">Loading countries...</div>
      ) : filtered.length === 0 ? (
        <div className="border p-12 text-center text-gray-500 bg-white">
          {search ? 'No countries match your search.' : 'No countries configured. Click "Load 40+ Defaults" to get started.'}
        </div>
      ) : (
        <div className="bg-white border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#3D3530] text-[#EBE6DD]">
                <th className="px-4 py-3 text-left font-medium">Country</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">VAT</th>
                <th className="px-4 py-3 text-left font-medium">Tax Label</th>
                <th className="px-4 py-3 text-left font-medium">Currency</th>
                <th className="px-4 py-3 text-left font-medium">Delivery</th>
                <th className="px-4 py-3 text-center font-medium">Rental</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.country_code} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2.5 font-medium text-[#3D3530]">{c.country_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.country_code}</td>
                  <td className="px-4 py-2.5">{c.vat_rate}%</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.tax_label}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.currency_code} — {c.currency_name}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{c.delivery_timeline || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {c.rental_available
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Yes</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">No</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => handleEdit(c)} className="text-[#3D3530] hover:text-[#7A3B3B] p-1">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c.country_code, c.country_name)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
