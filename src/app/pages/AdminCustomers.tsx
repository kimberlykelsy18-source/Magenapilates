import { useState, useEffect, useMemo } from 'react';
import { Search, Users, Download } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Customer {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  location: string;
  total_spend: number;
  orders_count: number;
  last_order: string;
  type: 'Buyer' | 'Renter' | 'Both';
}

const TYPE_BADGE: Record<string, string> = {
  Buyer: 'bg-green-100 text-green-700',
  Renter: 'bg-blue-100 text-blue-700',
  Both: 'bg-purple-100 text-purple-700',
};

export function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/customers`, { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to load customers');
      setCustomers(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      if (q && !c.customer_name.toLowerCase().includes(q) && !c.customer_email.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      return true;
    });
  }, [customers, search, typeFilter]);

  const stats = useMemo(() => ({
    total: customers.length,
    buyers: customers.filter((c) => c.type === 'Buyer' || c.type === 'Both').length,
    renters: customers.filter((c) => c.type === 'Renter' || c.type === 'Both').length,
    revenue: customers.reduce((s, c) => s + c.total_spend, 0),
  }), [customers]);

  const exportCSV = () => window.open(`${API}/api/admin/customers/export`, '_blank');

  return (
    <div>
      <div className="mb-6 flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl text-[#3D3530] flex items-center gap-2">
          <Users className="h-6 w-6" />
          Customers
        </h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 bg-[#3D3530] text-white px-3 py-2 text-xs hover:bg-[#2D2520]">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Customers</div>
          <div className="text-2xl font-semibold text-[#3D3530]">{stats.total}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Buyers</div>
          <div className="text-2xl font-semibold text-green-700">{stats.buyers}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Renters</div>
          <div className="text-2xl font-semibold text-blue-700">{stats.renters}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Revenue</div>
          <div className="text-lg font-semibold text-[#3D3530] truncate">KES {stats.revenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:border-[#3D3530]" />
          </div>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-[#3D3530] bg-white">
            <option value="all">All Types</option>
            <option value="Buyer">Buyer</option>
            <option value="Renter">Renter</option>
            <option value="Both">Both</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="border p-12 text-center text-gray-500 bg-white">No customers found</div>
      ) : (
        <div className="bg-white border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#3D3530] text-[#EBE6DD]">
                <th className="px-4 py-3 text-left font-medium">Name / Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Total Spend</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.customer_email} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#3D3530]">{c.customer_name}</div>
                    <div className="text-xs text-gray-500">{c.customer_email}</div>
                    {c.location && <div className="text-xs text-gray-400">{c.location}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{c.customer_phone || '—'}</td>
                  <td className="px-4 py-3 text-right text-sm">{c.orders_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-sm">KES {c.total_spend.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${TYPE_BADGE[c.type] || ''}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {new Date(c.last_order).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-400 border-t">
            Showing {filtered.length} of {customers.length} customers
          </div>
        </div>
      )}
    </div>
  );
}
