import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, DollarSign, Star, Download } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Analytics {
  total_orders: number;
  total_revenue: number;
  total_customers: number;
  average_order_value: number;
  total_waitlist: number;
  top_product: string;
  orders_by_country: { name: string; value: number }[];
  revenue_by_product: { name: string; revenue: number; count: number }[];
  buy_vs_rent: { name: string; value: number }[];
}

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: 'all', label: 'All Time' },
];

export function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  const load = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/analytics?period=${p}`, { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to load analytics');
      setData(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('all'); }, []);

  const handlePeriod = (p: string) => { setPeriod(p); load(p); };

  const exportCSV = () => window.open(`${API}/api/admin/orders/export`, '_blank');

  if (loading) return <div className="py-16 text-center text-gray-500">Loading analytics...</div>;
  if (!data) return null;

  const maxRevenue = Math.max(...data.revenue_by_product.map((p) => p.revenue), 1);
  const totalOrders = data.buy_vs_rent.reduce((s, v) => s + v.value, 0);

  const BAR_COLORS = ['#3D3530', '#7A3B3B', '#B5956A', '#8D6E63', '#A1887F'];

  return (
    <div>
      <div className="mb-6 flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl text-[#3D3530]">Analytics</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0 bg-white border border-gray-200">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => handlePeriod(p.value)}
                className={`px-3 py-1.5 text-xs transition-colors border-r border-gray-200 last:border-0 ${period === p.value ? 'bg-[#3D3530] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 bg-[#3D3530] text-white px-3 py-1.5 text-xs hover:bg-[#2D2520]">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-700" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</span>
          </div>
          <div className="text-xl font-semibold text-green-700 truncate">
            KES {data.total_revenue.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="h-4 w-4 text-[#3D3530]" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Total Orders</span>
          </div>
          <div className="text-xl font-semibold text-[#3D3530]">{data.total_orders}</div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-purple-700" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Avg Order Value</span>
          </div>
          <div className="text-xl font-semibold text-purple-700 truncate">
            KES {data.average_order_value.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-[#7A3B3B]" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Top Product</span>
          </div>
          <div className="text-sm font-semibold text-[#7A3B3B] leading-snug">{data.top_product}</div>
        </div>
      </div>

      {data.total_orders === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center text-gray-400">
          No order data for the selected period.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Product — horizontal bars */}
          {data.revenue_by_product.length > 0 && (
            <div className="bg-white border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-[#3D3530] mb-4 uppercase tracking-widest">Revenue by Product</h3>
              <div className="space-y-4">
                {data.revenue_by_product.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm text-[#3D3530] font-medium truncate pr-4">{p.name}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        KES {p.revenue.toLocaleString()} · {p.count} order{p.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((p.revenue / maxRevenue) * 100)}%`,
                          backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buy vs Rent Split — percentage bars */}
          {(data.buy_vs_rent[0]?.value > 0 || data.buy_vs_rent[1]?.value > 0) && (
            <div className="bg-white border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-[#3D3530] mb-4 uppercase tracking-widest">Purchase vs Rental Split</h3>
              <div className="space-y-5">
                {data.buy_vs_rent.map((item, i) => {
                  const pct = totalOrders > 0 ? Math.round((item.value / totalOrders) * 100) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-sm text-[#3D3530] font-medium">{item.name}</span>
                        <span className="text-xs text-gray-500">{item.value} order{item.value !== 1 ? 's' : ''} · {pct}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: i === 0 ? '#3D3530' : '#7A3B3B',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex gap-4">
                <div className="text-center flex-1">
                  <div className="text-xs text-gray-500 mb-0.5">Total Orders</div>
                  <div className="text-lg font-semibold text-[#3D3530]">{totalOrders}</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-xs text-gray-500 mb-0.5">Unique Customers</div>
                  <div className="text-lg font-semibold text-[#3D3530]">{data.total_customers}</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-xs text-gray-500 mb-0.5">Waitlist</div>
                  <div className="text-lg font-semibold text-[#3D3530]">{data.total_waitlist}</div>
                </div>
              </div>
            </div>
          )}

          {/* Orders by Country */}
          {data.orders_by_country.length > 0 && (
            <div className="bg-white border border-gray-200 p-5 lg:col-span-2">
              <h3 className="text-xs font-semibold text-[#3D3530] mb-4 uppercase tracking-widest">Orders by Country</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.orders_by_country.slice(0, 10).map((c, i) => {
                  const maxCount = data.orders_by_country[0]?.value || 1;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm text-[#3D3530]">{c.name}</span>
                        <span className="text-xs text-gray-500">{c.value}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((c.value / maxCount) * 100)}%`,
                            backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
