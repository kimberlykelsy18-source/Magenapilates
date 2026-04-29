import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Instagram } from 'lucide-react';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import logoImg from '../../assets/magena-pilates-logo.jpeg';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const CONTEXT_OPTIONS = [
  'Home use',
  'Physiotherapy / Rehabilitation clinic',
  'Pilates studio',
  'Gym or fitness centre',
  'Personal training studio',
  'Corporate wellness',
  'Other',
];

const PinterestIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

interface SocialSettings {
  instagramUrl?: string;
  pinterestUrl?: string;
}

interface ComingSoonProduct {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
}

const FALLBACK_COMING_SOON: ComingSoonProduct[] = [
  {
    id: 'wunda-chair',
    name: 'Wunda Chair',
    imageUrl: '',
    description: 'A compact, versatile apparatus for balance, core strength, and unilateral training. Built in hardwood.',
  },
  {
    id: 'classical-reformer',
    name: 'Classical Reformer',
    imageUrl: '',
    description: 'The centrepiece of classical Pilates. Handcrafted in hardwood with a full spring and rope system. Studio and home grade.',
  },
];

export function WaitlistPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socialSettings, setSocialSettings] = useState<SocialSettings>({});
  const [comingSoonProducts, setComingSoonProducts] = useState<ComingSoonProduct[]>(FALLBACK_COMING_SOON);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    equipmentInterest: [] as string[],
    contextOfUse: [] as string[],
    otherContext: '',
    unitsNeeded: '',
    buyOrRent: '',
    notes: '',
  });

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setSocialSettings({ instagramUrl: data.instagram_url, pinterestUrl: data.pinterest_url });
        }
      })
      .catch(() => {});

    fetch(`${API}/api/products`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const cs = data
            .filter((p) => p.status === 'coming-soon')
            .map((p) => ({ id: p.id, name: p.name, imageUrl: p.image_url || '', description: p.description || '' }));
          if (cs.length > 0) setComingSoonProducts(cs);
        }
      })
      .catch(() => {});
  }, []);

  const toggleEquipment = (item: string) => {
    setForm((prev) => ({
      ...prev,
      equipmentInterest: prev.equipmentInterest.includes(item)
        ? prev.equipmentInterest.filter((e) => e !== item)
        : [...prev.equipmentInterest, item],
    }));
  };

  const toggleContext = (item: string) => {
    setForm((prev) => ({
      ...prev,
      contextOfUse: prev.contextOfUse.includes(item)
        ? prev.contextOfUse.filter((c) => c !== item)
        : [...prev.contextOfUse, item],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.equipmentInterest.length === 0) {
      setError('Please select at least one equipment you are interested in.'); return;
    }
    if (form.contextOfUse.length === 0) {
      setError('Please select at least one context of use.'); return;
    }
    setLoading(true);
    setError('');

    const contextStr = form.contextOfUse.includes('Other') && form.otherContext
      ? [...form.contextOfUse.filter((c) => c !== 'Other'), `Other: ${form.otherContext}`].join(', ')
      : form.contextOfUse.join(', ');

    try {
      const res = await fetch(`${API}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          country: form.country,
          city_town: form.city,
          equipment_interest: form.equipmentInterest.join(', '),
          context_of_use: contextStr,
          units_needed: form.unitsNeeded,
          buy_or_rent: form.buyOrRent,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <header className="bg-[#EBE6DD] border-b border-[#3D3530] py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1" />
          <Link to="/">
            <img src={logoImg} alt="Magena Pilates" className="h-16" />
          </Link>
          <div className="flex-1 flex justify-end gap-3 pt-2">
            <a href={socialSettings.instagramUrl || 'https://instagram.com/magenapilates'}
              target="_blank" rel="noopener noreferrer"
              className="text-[#3D3530] hover:opacity-70 transition-opacity" aria-label="Instagram">
              <Instagram className="h-5 w-5" />
            </a>
            <a href={socialSettings.pinterestUrl || 'https://pinterest.com/magenapilates'}
              target="_blank" rel="noopener noreferrer"
              className="text-[#3D3530] hover:opacity-70 transition-opacity" aria-label="Pinterest">
              <PinterestIcon />
            </a>
          </div>
        </div>
        <nav className="flex justify-center gap-6">
          <Link to="/" className="text-sm text-[#3D3530] hover:underline">Order Equipment</Link>
          <Link to="/waitlist" className="text-sm text-[#3D3530] font-medium underline">Join Waitlist</Link>
          <Link to="/order-status" className="text-sm text-[#3D3530] hover:underline">Check Order Status</Link>
        </nav>
      </div>
    </header>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EBE6DD]">
        {header}
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl text-[#3D3530] mb-3">You're on the list!</h1>
          <p className="text-[#6B5C53] mb-6">
            Be the first to know when our new equipment is ready. We'll email you at <strong>{form.email}</strong>.
          </p>
          <Link to="/" className="inline-block bg-[#3D3530] text-[#EBE6DD] px-6 py-3 text-sm uppercase tracking-widest hover:bg-[#2D2520]">
            Back to Shop
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EBE6DD]">
      {header}

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl text-[#3D3530] mb-2">Join the Waitlist</h1>
          <p className="text-sm text-gray-600">Be the first to know when our new equipment is ready</p>
        </div>

        {/* Coming Soon product cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {comingSoonProducts.map((product) => (
            <div key={product.id} className="bg-white border border-[#3D3530] p-6">
              <div className="aspect-square bg-gray-100 mb-4">
                {product.imageUrl
                  ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
                }
              </div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg text-[#3D3530]">{product.name}</h3>
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 border border-yellow-300 shrink-0 ml-2">COMING SOON</span>
              </div>
              {product.description && (
                <p className="text-sm text-gray-600">{product.description}</p>
              )}
            </div>
          ))}
        </div>

        {/* Waitlist form */}
        <div className="bg-white border border-[#3D3530] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Contact Information */}
            <div className="space-y-4">
              <h2 className="text-xl text-[#3D3530] font-medium border-b pb-2">Contact Information</h2>

              <div>
                <Label htmlFor="wl-name" className="text-[#3D3530]">Full Name *</Label>
                <Input id="wl-name" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1" placeholder="John Doe" />
              </div>

              <div>
                <Label htmlFor="wl-email" className="text-[#3D3530]">Email Address *</Label>
                <Input id="wl-email" type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1" placeholder="john@example.com" />
              </div>

              <div>
                <Label htmlFor="wl-phone" className="text-[#3D3530]">Phone / WhatsApp *</Label>
                <Input id="wl-phone" type="tel" required value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1" placeholder="+254712345678" />
              </div>

              <div>
                <Label htmlFor="wl-country" className="text-[#3D3530]">Country *</Label>
                <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                  <SelectTrigger id="wl-country" className="mt-1">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kenya">Kenya</SelectItem>
                    <SelectItem value="Tanzania">Tanzania</SelectItem>
                    <SelectItem value="Uganda">Uganda</SelectItem>
                    <SelectItem value="Rwanda">Rwanda</SelectItem>
                    <SelectItem value="Ethiopia">Ethiopia</SelectItem>
                    <SelectItem value="USA">United States</SelectItem>
                    <SelectItem value="UK">United Kingdom</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="wl-city" className="text-[#3D3530]">City / Town *</Label>
                <Input id="wl-city" required value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="mt-1" placeholder="e.g., Nairobi" />
              </div>
            </div>

            {/* Equipment Interest */}
            <div>
              <h2 className="text-xl text-[#3D3530] font-medium border-b pb-2 mb-4">Equipment Interest</h2>
              <Label className="text-[#3D3530] mb-2 block">Which equipment are you interested in? *</Label>
              <div className="space-y-2">
                {['Wunda Chair', 'Classical Reformer', 'Both'].map((item) => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`eq-${item}`}
                      checked={form.equipmentInterest.includes(item)}
                      onCheckedChange={() => toggleEquipment(item)}
                    />
                    <Label htmlFor={`eq-${item}`} className="cursor-pointer">{item}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Details */}
            <div>
              <h2 className="text-xl text-[#3D3530] font-medium border-b pb-2 mb-4">Usage Details</h2>

              {/* Context of Use */}
              <div className="mb-4">
                <Label className="text-[#3D3530] mb-2 block">Context of use * (select all that apply)</Label>
                <div className="space-y-2">
                  {CONTEXT_OPTIONS.map((item) => (
                    <div key={item} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ctx-${item}`}
                        checked={form.contextOfUse.includes(item)}
                        onCheckedChange={() => toggleContext(item)}
                      />
                      <Label htmlFor={`ctx-${item}`} className="cursor-pointer">{item}</Label>
                    </div>
                  ))}
                </div>
                {form.contextOfUse.includes('Other') && (
                  <Input
                    value={form.otherContext}
                    onChange={(e) => setForm({ ...form, otherContext: e.target.value })}
                    className="mt-2"
                    placeholder="Please specify"
                  />
                )}
              </div>

              {/* Units needed */}
              <div className="mb-4">
                <Label htmlFor="wl-units" className="text-[#3D3530]">How many units would you need? *</Label>
                <Select value={form.unitsNeeded} onValueChange={(v) => setForm({ ...form, unitsNeeded: v })}>
                  <SelectTrigger id="wl-units" className="mt-1">
                    <SelectValue placeholder="Select quantity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 unit</SelectItem>
                    <SelectItem value="2-3">2–3 units</SelectItem>
                    <SelectItem value="4-6">4–6 units</SelectItem>
                    <SelectItem value="7+">7+ units</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Buy or Rent */}
              <div className="mb-4">
                <Label className="text-[#3D3530] mb-2 block">Are you interested in buying or renting? *</Label>
                <RadioGroup
                  value={form.buyOrRent}
                  onValueChange={(v) => setForm({ ...form, buyOrRent: v })}
                  className="space-y-2"
                >
                  {[
                    { value: 'buy',       label: 'Buy' },
                    { value: 'rent',      label: 'Rent (Kenya only)' },
                    { value: 'both',      label: 'Both' },
                    { value: 'undecided', label: 'Undecided' },
                  ].map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value} id={`br-${value}`} />
                      <Label htmlFor={`br-${value}`} className="cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="wl-notes" className="text-[#3D3530]">Additional notes (optional, 200 char limit)</Label>
                <Textarea id="wl-notes" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 200) })}
                  className="mt-1" maxLength={200} rows={3}
                  placeholder="Any additional information..." />
                <p className="text-xs text-gray-600 mt-1">{form.notes.length}/200 characters</p>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-[#3D3530] text-white py-4 text-lg hover:bg-[#2D2520] transition-colors disabled:opacity-60">
              {loading ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
