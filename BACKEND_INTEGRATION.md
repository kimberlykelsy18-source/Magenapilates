# Backend Integration Guide

This frontend is ready for backend integration with Pesapal and Safaricom (M-PESA) payment gateways.

## Current Setup

The application currently uses **localStorage** for data persistence. All order and product data is stored in the browser.

## Backend Integration Points

### 1. Order Submission (`/src/app/components/PreOrderForm.tsx`)

**Location:** Line ~64 in `PreOrderForm.tsx`

```typescript
// TODO: Backend integration point
// This is where you'll integrate with Pesapal/Safaricom payment gateway
// Send order data to your backend API
// Example: await fetch('/api/orders', { method: 'POST', body: JSON.stringify(order) })

storage.addOrder(order);
```

**What to do:**
1. Replace `storage.addOrder(order)` with an API call to your backend
2. Send the `order` object to your backend endpoint
3. Backend should:
   - Save order to database
   - Initiate payment with Pesapal or Safaricom
   - Return payment redirect URL or M-PESA prompt
   - Update order status based on payment callback

**Order Data Structure:**
```typescript
{
  id: string;
  productId: string;
  productName: string;
  orderType: 'purchase' | 'rental';
  quantity: number;
  wantsEngraving: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  totalAmount: number;
  depositAmount?: number;
  orderDate: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}
```

### 2. Admin Order Management (`/src/app/pages/AdminOrders.tsx`)

Replace localStorage calls with API calls:

- **Load Orders:** `storage.getOrders()` → `GET /api/orders`
- **Update Order:** `storage.updateOrder(id, updates)` → `PATCH /api/orders/:id`
- **Delete Order:** `storage.deleteOrder(id)` → `DELETE /api/orders/:id`

### 3. Admin Product Management (`/src/app/pages/AdminProducts.tsx`)

Replace localStorage calls with API calls:

- **Load Products:** `storage.getProducts()` → `GET /api/products`
- **Add Product:** `storage.saveProducts(products)` → `POST /api/products`
- **Update Product:** `storage.saveProducts(products)` → `PUT /api/products/:id`

### 4. Payment Gateway Integration

#### Pesapal Integration
1. Create backend endpoint to initialize Pesapal payment
2. After order submission, redirect user to Pesapal payment page
3. Set up callback URL to handle payment confirmation
4. Update order status based on payment result

#### Safaricom M-PESA Integration
1. Create backend endpoint to initiate STK Push
2. After order submission, trigger M-PESA prompt on customer's phone
3. Set up callback URL to receive payment notification
4. Update order status based on payment result

## Recommended Backend Structure

```
/api
  /orders
    POST /           - Create new order & initiate payment
    GET /            - Get all orders (admin)
    GET /:id         - Get order details
    PATCH /:id       - Update order status
    DELETE /:id      - Delete order
  
  /products
    GET /            - Get all products
    POST /           - Create product (admin)
    PUT /:id         - Update product (admin)
    DELETE /:id      - Delete product (admin)
  
  /payments
    POST /pesapal    - Initialize Pesapal payment
    POST /mpesa      - Initialize M-PESA STK Push
    POST /callback/pesapal  - Pesapal callback
    POST /callback/mpesa    - M-PESA callback
```

## Admin Authentication

Current: Simple password in frontend (password: `magena2025`)

**For production:** Replace with proper backend authentication:
1. Create `/api/auth/login` endpoint
2. Return JWT token
3. Store token in localStorage
4. Send token in Authorization header for all admin requests

## Environment Variables (Backend)

```env
PESAPAL_CONSUMER_KEY=your_key
PESAPAL_CONSUMER_SECRET=your_secret
PESAPAL_CALLBACK_URL=https://yourdomain.com/api/payments/callback/pesapal

SAFARICOM_CONSUMER_KEY=your_key
SAFARICOM_CONSUMER_SECRET=your_secret
SAFARICOM_SHORTCODE=your_paybill
SAFARICOM_PASSKEY=your_passkey
SAFARICOM_CALLBACK_URL=https://yourdomain.com/api/payments/callback/mpesa
```

## Notes

- All prices are in KES (Kenyan Shillings)
- Rental deposit is refundable
- Free engraving is only available during pre-order period
- Frontend validation is in place - backend should also validate all inputs