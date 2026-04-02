import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Package, ShoppingCart, LogOut, Settings } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function getAdminToken() {
  return localStorage.getItem('admin_token');
}

export function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAdminToken()}`,
  };
}

export function AdminDashboard() {
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('admin_token')
  );
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('admin_token', data.token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#EBE6DD] flex items-center justify-center">
        <div className="bg-white border border-[#3D3530] p-8 w-full max-w-md">
          <h1 className="text-2xl mb-6 text-[#3D3530]">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm mb-2 text-[#3D3530]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#3D3530] px-3 py-2"
                placeholder="Enter admin password"
                required
              />
            </div>
            {loginError && <p className="text-red-600 text-sm mb-3">{loginError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3D3530] text-white py-2 hover:bg-[#2D2520] disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isOrdersPage = location.pathname === '/admin' || location.pathname === '/admin/orders';
  const isProductsPage = location.pathname === '/admin/products';
  const isSettingsPage = location.pathname === '/admin/settings';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#3D3530] text-white border-b border-[#2D2520]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl">MAGENA PILATES — Admin</h1>
          <div className="flex gap-4 items-center">
            <Link to="/" className="text-sm hover:underline">
              View Customer Page
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm border border-white px-3 py-1 hover:bg-white hover:text-[#3D3530]"
            >
              <LogOut className="h-4 w-4 inline mr-1" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <Link to="/admin/orders">
              <button
                className={`px-6 py-3 border-b-2 ${
                  isOrdersPage ? 'border-[#3D3530] font-medium' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="h-4 w-4 inline mr-2" />
                Orders
              </button>
            </Link>
            <Link to="/admin/products">
              <button
                className={`px-6 py-3 border-b-2 ${
                  isProductsPage ? 'border-[#3D3530] font-medium' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <Package className="h-4 w-4 inline mr-2" />
                Products
              </button>
            </Link>
            <Link to="/admin/settings">
              <button
                className={`px-6 py-3 border-b-2 ${
                  isSettingsPage ? 'border-[#3D3530] font-medium' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <Settings className="h-4 w-4 inline mr-2" />
                Settings
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
