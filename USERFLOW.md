# Magena Pilates — User Flow

## Overview
Magena Pilates is a pre-order platform for Pilates equipment. Customers can purchase or rent equipment by pre-ordering and paying online via card (Pesapal) or M-PESA.

---

## Customer Flow

### 1. Landing on the Page
- Customer visits the site URL
- Sees a list of available Pilates equipment (Spine Corrector, Pilates Barrel)
- "Coming Soon" items are visible but not orderable
- Currency selector allows price display in 9 East African currencies (KES, TZS, UGX, etc.)

### 2. Selecting a Product
- Customer selects quantity using `+` / `−` controls
- Clicks **"Pre-Order Now"** on an available product
- A pre-order form dialog opens

### 3. Filling the Pre-Order Form
Customer fills in:
- **Order Type** — Purchase (one-time) or Rental (monthly with deposit)
- **Free Engraving** — Checkbox to add FREE logo engraving (purchase only, worth KES 3,500)
- **Personal Info** — Full name, email, phone number, delivery address
- **Payment Method** — Card (via Pesapal) or M-PESA

Order summary is shown with:
- Product × quantity
- Monthly rental OR purchase price
- Refundable deposit (rental only)
- Total due now

Customer clicks **"PROCEED TO PAYMENT"**

### 4a. Card Payment (Pesapal)
- Frontend calls `POST /api/orders` with form data
- Backend creates the order in the database (`status: pending_payment`)
- Backend submits the order to Pesapal and receives a `redirect_url`
- Frontend redirects customer to Pesapal hosted checkout
- Customer enters card details on Pesapal's secure page (Visa, Mastercard)
- Pesapal processes payment

**On success:**
- Pesapal redirects customer to `/order-success?trackingId=<uuid>`
- Frontend polls `GET /api/pesapal/status/:trackingId`
- Backend verifies with Pesapal API, updates order to `confirmed`, sends emails
- Customer sees a confirmation screen with their order ID and receipt details

**On failure/cancellation:**
- Customer redirected to `/order-cancelled`
- Order status updated to `cancelled`

### 4b. M-PESA Payment (Paybill — manual for now)
- Frontend calls `POST /api/orders`
- Backend creates order, sends customer an email with:
  - Their order ID (e.g. `PRE-A001`)
  - Amount due
  - Paybill number and account number (their order ID)
- Customer pays manually via M-PESA paybill
- Admin confirms payment and updates order status in the Admin Dashboard
- *(STK Push integration will be added once paybill documents are received)*

### 5. Order Confirmation
Customer receives an email containing:
- Order ID (e.g. `PRE-A001`)
- Product name and order type
- Amount paid + payment reference
- Delivery address
- What happens next (admin will contact them)

---

## Admin Flow

### 1. Admin Login
- Admin visits `/admin`
- Enters admin password
- Frontend calls `POST /api/admin/login` → receives a JWT token (valid 12 hours)
- Token stored in `localStorage`, sent as `Authorization: Bearer <token>` on all admin API calls

### 2. Orders Dashboard (`/admin/orders`)
- Loads all pre-orders from `GET /api/admin/orders`
- Admin can:
  - Filter by status (pending, confirmed, completed, cancelled)
  - View full order details (customer info, product, amount, payment method)
  - Update order status via `PATCH /api/admin/orders/:id`
  - Delete an order via `DELETE /api/admin/orders/:id`
- For M-PESA orders: admin manually confirms payment and updates status to `confirmed`

### 3. Products Management (`/admin/products`)
- Loads all products from `GET /api/products`
- Admin can:
  - Add new products via `POST /api/admin/products`
  - Edit product name, description, images, pricing, status
  - Toggle products as `available` or `coming-soon`
  - Delete products via `DELETE /api/admin/products/:id`

### 4. Settings (`/admin/settings`)
- Loads settings from `GET /api/admin/settings`
- Admin can update:
  - Pre-order terms (bullet points shown to customers)
  - Engraving price (post pre-order period)
  - Rental fixed-rate period (months)
- Saves via `PUT /api/admin/settings`

---

## Email Notifications

| Trigger | Recipient | Content |
|---|---|---|
| Card pre-order confirmed | Customer | Order ID, product, amount paid, payment reference, delivery address |
| Card pre-order confirmed | Admin | Full order details (name, email, phone, product, amount) |
| M-PESA order received | Customer | Order ID, amount due, paybill payment instructions |
| Payment failed/reversed | — | Order cancelled silently (no email; customer sees failure page) |

---

## API Summary

### Public Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | List all products |
| `GET` | `/api/settings` | Get site settings (terms, prices) |
| `POST` | `/api/orders` | Create pre-order + initiate payment |
| `GET` | `/api/orders/:id` | Get order by ID |
| `GET` | `/api/pesapal/status/:trackingId` | Poll payment status |
| `GET` | `/pesapal/ipn` | Pesapal webhook (called by Pesapal) |

### Admin Endpoints (require JWT)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Login → get JWT |
| `GET` | `/api/admin/orders` | List all orders |
| `PATCH` | `/api/admin/orders/:id` | Update order status |
| `DELETE` | `/api/admin/orders/:id` | Delete order |
| `POST` | `/api/admin/products` | Create product |
| `PUT` | `/api/admin/products/:id` | Update product |
| `DELETE` | `/api/admin/products/:id` | Delete product |
| `GET` | `/api/admin/settings` | Get settings |
| `PUT` | `/api/admin/settings` | Update settings |

---

## Order Status Lifecycle

```
pending_payment  →  confirmed  →  completed
                 ↘
                  cancelled
```

- `pending_payment` — Order created, awaiting payment confirmation
- `confirmed` — Payment verified; equipment being prepared
- `completed` — Equipment delivered / rental period active
- `cancelled` — Payment failed, timed out, or admin cancelled

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| Payments | Pesapal (card), M-PESA paybill (pending) |
| Email | Gmail SMTP via Nodemailer |
| Auth (Admin) | JWT (12h expiry) |

---

## Environment Setup Checklist

- [ ] Create Supabase project → run `schema.sql` in SQL Editor
- [ ] Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `Backend/.env`
- [ ] Set up Gmail App Password → fill `GMAIL_EMAIL` and `GMAIL_PASSWORD`
- [ ] Set `ADMIN_EMAIL` (where admin notification emails go)
- [ ] Set `JWT_SECRET` to a long random string
- [ ] Set `ADMIN_PASSWORD` (can be plaintext; hash it with bcrypt for production)
- [ ] Set `FRONTEND_URL` and `BACKEND_URL` to production URLs when deploying
- [ ] Run `npm install` in `Backend/`
- [ ] Run `npm run dev` in `Backend/` to start the server
- [ ] Add `VITE_API_URL=http://localhost:3000` to `.env` in the project root
