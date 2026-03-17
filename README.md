# Magena Pilates Pre-Order System

A simple, practical pre-order system for Pilates equipment with customer-facing and admin interfaces.

## Features

### Customer Page (/)
- View all available Pilates equipment with images
- See purchase and rental pricing
- Select quantity for each product
- Complete checkout with full customer details
- Choose between purchase or rental
- Optional FREE logo engraving for purchases (worth KES 3,500)
- Pre-order terms clearly displayed

### Admin Dashboard (/admin)
- **Login password:** `magena2025`
- **Orders Management:** View, update status, and manage all pre-orders
- **Product Management:** Add, edit, and update product pricing and availability
- CRUD operations for products

## Current Products

1. **Spine Corrector**
   - Purchase: KES 45,000
   - Monthly Rental: KES 2,400 + KES 10,000 deposit

2. **Pilates Barrel**
   - Purchase: KES 74,500
   - Monthly Rental: KES 4,600 + KES 15,000 deposit

3. **Wunda Chair** - Coming Soon
4. **Reformer** - Coming Soon

## Pre-Order Terms

- Current prices are pre-order prices only
- Prices will increase after pre-order period closes
- **Rentals:** Pay Deposit + Monthly Rent (deposit is refundable)
- Pre-order rental price is fixed for first **5 months**
- **FREE logo engraving** during pre-order (worth KES 3,500 per equipment)
- All prices apply per equipment

## Technical Details

### Current Storage
- Uses **localStorage** for data persistence
- Ready for backend integration

### Backend Integration
- See `BACKEND_INTEGRATION.md` for complete integration guide
- Payment gateway ready for Pesapal and Safaricom M-PESA
- Clear TODO comments in code for integration points

### Color Scheme
- Background: `#EBE6DD` (Beige/Cream)
- Text/Borders: `#3D3530` (Dark Brown)

## Usage

1. **Customer orders:**
   - Browse products at `/`
   - Select quantity
   - Click "ORDER NOW"
   - Fill in complete checkout form
   - Submit order

2. **Admin management:**
   - Login at `/admin` with password `magena2025`
   - View and manage orders
   - Update product prices and availability

## Next Steps for Production

1. Integrate backend API (see BACKEND_INTEGRATION.md)
2. Set up Pesapal payment gateway
3. Configure Safaricom M-PESA integration
4. Deploy to production server
5. Update admin password in `/src/app/pages/AdminDashboard.tsx`

## Notes

- Design is practical and minimal - focused on functionality
- Good UX with clear information flow
- All validation in place on frontend
- Backend developer can easily integrate payment systems
