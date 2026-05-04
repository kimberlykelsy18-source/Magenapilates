import { useState, useEffect, useMemo } from 'react';
import { Trash2, Download, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

import { API_URL as API } from '../utils/config';

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  city_town?: string;
  equipment_interest: string;
  context_of_use?: string;
  units_needed?: string;
  buy_or_rent?: string;
  notes?: string;
  created_at: string;
}

export function AdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [filterCountry, setFilterCountry] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/waitlist`, { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to load waitlist');
      setEntries(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the waitlist?`)) return;
    try {
      const res = await fetch(`${API}/api/admin/waitlist/${id}`, { method: 'DELETE', headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to remove entry');
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Entry removed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const exportCSV = () => window.open(`${API}/api/admin/waitlist/export`, '_blank');

  const stats = useMemo(() => ({
    total: entries.length,
    wunda: entries.filter((e) => e.equipment_interest.toLowerCase().includes('wunda')).length,
    reformer: entries.filter((e) => e.equipment_interest.toLowerCase().includes('reformer')).length,
  }), [entries]);

  const uniqueEquipment = useMemo(() =>
    [...new Set(entries.map((e) => e.equipment_interest).filter(Boolean))],
    [entries]);

  const uniqueCountries = useMemo(() =>
    [...new Set(entries.map((e) => e.country).filter(Boolean) as string[])].sort(),
    [entries]);

  const filtered = useMemo(() => entries.filter((e) => {
    const q = search.toLowerCase();
    if (q && !e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
    if (filterEquipment && e.equipment_interest !== filterEquipment) return false;
    if (filterCountry && e.country !== filterCountry) return false;
    return true;
  }), [entries, search, filterEquipment, filterCountry]);

  const truncateContext = (ctx?: string) => {
    if (!ctx) return '—';
    const parts = ctx.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 2) return parts.join(', ') || '—';
    return parts.slice(0, 2).join(', ') + '...';
  };

  const hasFilters = search || filterEquipment || filterCountry;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl text-[#3D3530] flex items-center gap-2">
          <Clock className="h-6 w-6" />
          Waitlist
        </h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 bg-[#3D3530] text-white px-3 py-2 text-xs hover:bg-[#2D2520]">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Signups</div>
          <div className="text-2xl font-semibold text-[#3D3530]">{stats.total}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Wunda Chair Interest</div>
          <div className="text-2xl font-semibold text-[#3D3530]">{stats.wunda}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reformer Interest</div>
          <div className="text-2xl font-semibold text-[#3D3530]">{stats.reformer}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:border-[#3D3530]" />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">Equipment</label>
          <select value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-[#3D3530] bg-white">
            <option value="">All Equipment</option>
            {uniqueEquipment.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Country</label>
          <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-[#3D3530] bg-white">
            <option value="">All Countries</option>
            {uniqueCountries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterEquipment(''); setFilterCountry(''); }}
            className="text-xs text-gray-500 hover:text-[#3D3530] underline self-end pb-1.5">
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500">Loading waitlist...</div>
      ) : filtered.length === 0 ? (
        <div className="border p-12 text-center text-gray-500 bg-white">
          {entries.length === 0 ? 'No waitlist entries found' : 'No entries match the current filters'}
        </div>
      ) : (
        <div className="bg-white border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#3D3530] text-[#EBE6DD]">
                <th className="px-3 py-3 text-left font-medium w-8">#</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Country</th>
                <th className="px-4 py-3 text-left font-medium">Equipment</th>
                <th className="px-4 py-3 text-left font-medium">Context</th>
                <th className="px-4 py-3 text-left font-medium">Units</th>
                <th className="px-4 py-3 text-left font-medium">Buy/Rent</th>
                <th className="px-4 py-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#3D3530]">{e.name}</div>
                    {e.phone && <div className="text-xs text-gray-500">{e.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{e.email}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    <div>{e.country || '—'}</div>
                    {e.city_town && <div className="text-xs text-gray-400">{e.city_town}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{e.equipment_interest}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px]">{truncateContext(e.context_of_use)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.units_needed || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.buy_or_rent || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(e.id, e.name)}
                      className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-400 border-t">
            Showing {filtered.length} of {entries.length} entries
          </div>
        </div>
      )}
    </div>
  );
}
