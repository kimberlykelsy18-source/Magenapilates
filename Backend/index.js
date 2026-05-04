require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { supabase, serviceSupabase } = require('./config/supabase');
const { transporter } = require('./config/email');
const { startPaymentCleanup } = require('./services/paymentCleanup');

const createProductRoutes  = require('./routes/products');
const createOrderRoutes    = require('./routes/orders');
const createPaymentRoutes  = require('./routes/payments');
const createAdminRoutes    = require('./routes/admin');
const createWaitlistRoutes = require('./routes/waitlist');
const createCountryRoutes  = require('./routes/countryTax');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = process.env.FRONTEND_URL?.trim();
    const allowedVariants = [];
    if (allowed) {
      allowedVariants.push(allowed);
      try {
        const url = new URL(allowed);
        if (url.hostname.startsWith('www.')) {
          allowedVariants.push(`${url.protocol}//${url.hostname.slice(4)}`);
        } else {
          allowedVariants.push(`${url.protocol}//www.${url.hostname}`);
        }
      } catch (_) { /* ignore */ }
    }
    if (
      !allowed ||
      allowedVariants.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /\.vercel\.app$/.test(origin)
    ) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } });
const orderLimiter   = rateLimit({ windowMs: 60 * 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many orders from this IP.' } });
const loginLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,   standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts.' } });
const waitlistLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5,  standardHeaders: true, legacyHeaders: false, message: { error: 'Too many waitlist submissions.' } });

app.use('/api', generalLimiter);
app.use('/api/orders', orderLimiter);
app.use('/api/admin/login', loginLimiter);
app.use('/api/waitlist', waitlistLimiter);

app.use(createProductRoutes({ supabase, serviceSupabase }));
app.use(createOrderRoutes({ supabase, serviceSupabase, transporter }));
app.use(createPaymentRoutes({ transporter }));
app.use(createAdminRoutes({ serviceSupabase, transporter }));
app.use(createWaitlistRoutes({ serviceSupabase, transporter }));
app.use(createCountryRoutes({ serviceSupabase }));

// Public — site settings (excludes large finish image data)
app.get('/api/settings', async (_req, res) => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('terms, engraving_price, rental_fixed_months, rental_deposit_formula, exchange_rate, instagram_url, pinterest_url, whatsapp_number, footer_disclaimer, post_order_message, waitlist_message, leather_finishes, wood_finishes, mpesa_paybill')
    .eq('id', 1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.json(data || { terms: [], engraving_price: 3500, rental_fixed_months: 5, exchange_rate: 130 });
});

app.get('/', (_req, res) => res.json({ message: 'Magena Pilates Backend ✅' }));

// eslint-disable-next-line no-unused-vars
app.use(function errorHandler(err, req, res, next) {
  if (err.message?.startsWith('CORS:')) return res.status(403).json({ error: err.message });
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Magena Pilates server running on http://localhost:${PORT}`);
  startPaymentCleanup();
});
