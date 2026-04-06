require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { supabase, serviceSupabase } = require('./config/supabase');
const { transporter } = require('./config/email');
const { startPaymentCleanup } = require('./services/paymentCleanup');

const createProductRoutes = require('./routes/products');
const createOrderRoutes = require('./routes/orders');
const createPaymentRoutes = require('./routes/payments');
const createAdminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// CORS — allow the configured frontend URL plus any Vercel preview deployments
const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin header) and Flutterwave webhook calls
    if (!origin) return callback(null, true);

    const allowed = process.env.FRONTEND_URL?.trim();

    // Allow exact match, any vercel.app preview URL, and localhost for dev
    if (
      !allowed ||                                    // not set → allow all
      origin === allowed ||                          // exact production URL
      /^https?:\/\/localhost(:\d+)?$/.test(origin) || // local dev
      /\.vercel\.app$/.test(origin)                  // Vercel preview URLs
    ) {
      return callback(null, true);
    }

    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(morgan('dev'));

// Rate limiting — general API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Stricter limit on order creation (checkout)
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many orders from this IP. Please try again later.' },
});

// Stricter limit on admin login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use('/api', generalLimiter);
app.use('/api/orders', orderLimiter);
app.use('/api/admin/login', loginLimiter);

app.use(createProductRoutes({ supabase, serviceSupabase }));
app.use(createOrderRoutes({ supabase, serviceSupabase, transporter }));
app.use(createPaymentRoutes({ transporter }));
app.use(createAdminRoutes({ serviceSupabase }));

// Public — get site settings
app.get('/api/settings', async (req, res) => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || { terms: [], engraving_price: 3500, rental_fixed_months: 5 });
});

app.get('/', (req, res) => {
  res.json({ message: 'Magena Pilates Backend ✅' });
});

// Global JSON error handler — must have exactly 4 params to be treated as error middleware
// eslint-disable-next-line no-unused-vars
app.use(function errorHandler(err, req, res, next) {
  // CORS errors from the origin check
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Magena Pilates server running on http://localhost:${PORT}`);
  startPaymentCleanup();
});
