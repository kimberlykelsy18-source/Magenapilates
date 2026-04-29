import { useState, useEffect } from 'react';
import { Save, Instagram, MessageCircle, Link as LinkIcon, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { adminHeaders } from './AdminDashboard';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Tab = 'general' | 'rental' | 'confirmation' | 'admin';

interface Settings {
  terms: string[];
  engraving_price: number;
  rental_fixed_months: number;
  rental_deposit_formula: string;
  instagram_url: string;
  pinterest_url: string;
  whatsapp_number: string;
  footer_disclaimer: string;
  post_order_message: string;
  waitlist_message: string;
}

const DEFAULT_SETTINGS: Settings = {
  terms: [],
  engraving_price: 3500,
  rental_fixed_months: 5,
  rental_deposit_formula: '',
  instagram_url: '',
  pinterest_url: '',
  whatsapp_number: '',
  footer_disclaimer: '',
  post_order_message: '',
  waitlist_message: '',
};

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/settings`, { headers: adminHeaders() })
      .then((r) => r.json())
      .then((s) => {
        setSettings({
          terms: s.terms || [],
          engraving_price: s.engraving_price ?? 3500,
          rental_fixed_months: s.rental_fixed_months ?? 5,
          rental_deposit_formula: s.rental_deposit_formula || '',
          instagram_url: s.instagram_url || '',
          pinterest_url: s.pinterest_url || '',
          whatsapp_number: s.whatsapp_number || '',
          footer_disclaimer: s.footer_disclaimer || '',
          post_order_message: s.post_order_message || '',
          waitlist_message: s.waitlist_message || '',
        });
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) { toast.error('New passwords do not match'); return; }
    setPwSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/password`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ current_password: passwordForm.current_password, new_password: passwordForm.new_password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      toast.success('Password changed');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-gray-500">Loading settings...</div>;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'rental', label: 'Rental Settings' },
    { id: 'confirmation', label: 'Confirmation & Terms' },
    { id: 'admin', label: 'Admin Access' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl text-[#3D3530]">Site Settings</h2>
        {activeTab !== 'admin' && (
          <button onClick={handleSave} disabled={saving}
            className="bg-[#3D3530] text-white px-4 py-2 text-sm hover:bg-[#2D2520] flex items-center gap-2 disabled:opacity-60">
            <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="flex gap-0.5 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${activeTab === t.id ? 'border-[#3D3530] text-[#3D3530] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 p-6 space-y-6">

        {/* GENERAL */}
        {activeTab === 'general' && (
          <>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-4">Social Media Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Instagram className="h-3.5 w-3.5" /> Instagram URL
                  </label>
                  <input value={settings.instagram_url} onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/magenapilates"
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                  <p className="text-xs text-gray-400 mt-1">Appears in the top-right corner of all customer pages</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <LinkIcon className="h-3.5 w-3.5" /> Pinterest URL
                  </label>
                  <input value={settings.pinterest_url} onChange={(e) => setSettings({ ...settings, pinterest_url: e.target.value })}
                    placeholder="https://pinterest.com/magenapilates"
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Number (with country code)
                  </label>
                  <input value={settings.whatsapp_number} onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                    placeholder="+254712345678"
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Footer Disclaimer Text</label>
                  <textarea value={settings.footer_disclaimer} onChange={(e) => setSettings({ ...settings, footer_disclaimer: e.target.value })}
                    placeholder="© 2026 Magena Pilates. All rights reserved." rows={2}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530] resize-none" />
                  <p className="text-xs text-gray-400 mt-1">Customer Site Footer Text — appears at the bottom of the customer order page</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-4">Currency & Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Engraving Price (KES)</label>
                  <input type="number" min="0" value={settings.engraving_price}
                    onChange={(e) => setSettings({ ...settings, engraving_price: Number(e.target.value) })}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                  <p className="text-xs text-gray-400 mt-1">Charged for engraving after the pre-order period ends</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* RENTAL SETTINGS */}
        {activeTab === 'rental' && (
          <>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-4">Rental Settings</h3>
              <p className="text-xs text-gray-400 mb-4">Commercial use only. Rental requires business registration.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Minimum Rental Period (Months)</label>
                  <input type="number" min="1" value={settings.rental_fixed_months}
                    onChange={(e) => setSettings({ ...settings, rental_fixed_months: Number(e.target.value) })}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                  <p className="text-xs text-gray-400 mt-1">Minimum rental commitment for commercial clients</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rental Deposit Formula</label>
                  <input value={settings.rental_deposit_formula}
                    onChange={(e) => setSettings({ ...settings, rental_deposit_formula: e.target.value })}
                    placeholder="e.g. KES 5,500 rent = KES 6,500 deposit"
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                  <p className="text-xs text-gray-400 mt-1">Standard deposit calculation shown internally</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-4">Rental Agreement Terms</h3>
              <div className="space-y-2 mb-3">
                {settings.terms.map((term, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={term} onChange={(e) => { const t = [...settings.terms]; t[i] = e.target.value; setSettings({ ...settings, terms: t }); }}
                      className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                    <button onClick={() => setSettings({ ...settings, terms: settings.terms.filter((_, idx) => idx !== i) })}
                      className="border border-red-300 text-red-500 px-2 py-2 hover:bg-red-50 text-sm">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Add new term..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && newTerm.trim()) { setSettings({ ...settings, terms: [...settings.terms, newTerm.trim()] }); setNewTerm(''); } }}
                  className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
                <button onClick={() => { if (newTerm.trim()) { setSettings({ ...settings, terms: [...settings.terms, newTerm.trim()] }); setNewTerm(''); } }}
                  className="bg-[#3D3530] text-white px-3 py-2 hover:bg-[#2D2520] text-sm">+ Add</button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRMATION & TERMS */}
        {activeTab === 'confirmation' && (
          <>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#3D3530] mb-2">
                Order Confirmation Settings — Post-Order Confirmation Message
              </label>
              <textarea value={settings.post_order_message} onChange={(e) => setSettings({ ...settings, post_order_message: e.target.value })}
                placeholder="Thank you for your pre-order! We will be in touch shortly with production updates." rows={3}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530] resize-none" />
              <p className="text-xs text-gray-400 mt-1">Shown to customer after placing an order</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#3D3530] mb-2">
                Waitlist Confirmation Message
              </label>
              <textarea value={settings.waitlist_message} onChange={(e) => setSettings({ ...settings, waitlist_message: e.target.value })}
                placeholder="Thank you for joining our waitlist! We will notify you as soon as the equipment becomes available." rows={2}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530] resize-none" />
              <p className="text-xs text-gray-400 mt-1">Sent in the waitlist confirmation email</p>
            </div>
          </>
        )}

        {/* ADMIN ACCESS */}
        {activeTab === 'admin' && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#3D3530] mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Change Admin Password
            </h3>
            <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Current Password</label>
                <input type="password" required value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New Password (min. 8 characters)</label>
                <input type="password" required minLength={8} value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
                <input type="password" required value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#3D3530]" />
              </div>
              <button type="submit" disabled={pwSaving}
                className="bg-[#3D3530] text-white px-4 py-2 text-sm hover:bg-[#2D2520] disabled:opacity-60 flex items-center gap-2">
                <Save className="h-4 w-4" />{pwSaving ? 'Changing...' : 'Change Password'}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-4">
              To make the password change permanent, update the <code className="bg-gray-100 px-1">ADMIN_PASSWORD</code> environment variable on your hosting platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
