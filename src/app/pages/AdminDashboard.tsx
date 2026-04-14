import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Package, ShoppingCart, LogOut, Settings, Lock, Eye, EyeOff, ArrowRight, Mail } from 'lucide-react';
import adminLoginBg from '../../assets/admin_login_bg.png';
import adminDashBg from '../../assets/admin_dashboard_bg.png';
import logoStackedDark from '../../assets/magena-logo-stacked-dark.svg';
import logoHorizontalDark from '../../assets/magena-logo-horizontal-dark.svg';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('admin_token')
  );
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
    setEmail('');
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col md:flex-row overflow-auto"
        style={{ backgroundImage: `url(${adminLoginBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      >
        {/* ── Left panel — transparent, logo floats over background ── */}
        <div className="flex-shrink-0 w-full md:w-[55%] min-h-[200px] md:min-h-0 flex flex-col items-center justify-center px-10 py-12 md:py-0">
          <div className="flex flex-col items-center text-center gap-4 max-w-xs">
            <img
              src={logoStackedDark}
              alt="Magena Pilates"
              className="w-64 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <p className="text-[#EBE6DD]/80 text-xs tracking-[0.3em] uppercase font-medium">
              Admin Portal
            </p>
          </div>
        </div>

        {/* ── Right panel — transparent, form fields float over background ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 md:py-0">
          <div className="w-full max-w-[380px]">
            <h1 className="text-[28px] font-bold text-[#3D3530] leading-tight mb-1">Login</h1>
            <p className="text-[13px] text-[#6B5C53] mb-7">Sign in to your admin account</p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6B5C53] mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-[#3D3530] focus:ring-2 focus:ring-[#3D3530]/10 outline-none transition-all text-[14px] text-gray-900 placeholder:text-gray-400"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6B5C53] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3.5 rounded-xl bg-white border border-gray-200 focus:border-[#3D3530] focus:ring-2 focus:ring-[#3D3530]/10 outline-none transition-all text-[14px] text-gray-900 placeholder:text-gray-400"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#3D3530] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && <p className="text-red-700 text-sm">{loginError}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#3D3530] text-[#EBE6DD] py-3.5 rounded-full text-[12px] font-bold uppercase tracking-widest hover:bg-[#2D2520] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-70"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-[#EBE6DD] border-t-transparent rounded-full animate-spin" />
                  : <><span>Sign In</span><ArrowRight className="w-4 h-4 shrink-0" /></>
                }
              </button>
            </form>

            <p className="mt-8 text-center text-[11px] text-[#6B5C53]/70">
              Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOrdersPage = location.pathname === '/admin' || location.pathname === '/admin/orders';
  const isProductsPage = location.pathname === '/admin/products';
  const isSettingsPage = location.pathname === '/admin/settings';

  return (
    <div className="min-h-screen" style={{ backgroundImage: `url(${adminDashBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
      <header className="bg-[#3D3530] text-white border-b border-[#2D2520]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <img
            src={logoHorizontalDark}
            alt="Magena Pilates"
            className="h-10 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
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
