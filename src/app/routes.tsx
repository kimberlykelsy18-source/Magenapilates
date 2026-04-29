import { createBrowserRouter, Navigate } from 'react-router';
import { CustomerPage } from './pages/CustomerPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminOrders } from './pages/AdminOrders';
import { AdminProducts } from './pages/AdminProducts';
import { AdminSettings } from './pages/AdminSettings';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AdminCustomers } from './pages/AdminCustomers';
import { AdminWaitlist } from './pages/AdminWaitlist';
import { AdminPricing } from './pages/AdminPricing';
import { AdminCountryTax } from './pages/AdminCountryTax';
import { AdminFinishOptions } from './pages/AdminFinishOptions';
import { OrderSuccess } from './pages/OrderSuccess';
import { OrderCancelled } from './pages/OrderCancelled';
import { OrderStatus } from './pages/OrderStatus';
import { WaitlistPage } from './pages/WaitlistPage';

export const router = createBrowserRouter([
  { path: '/', element: <CustomerPage /> },
  { path: '/order-success', element: <OrderSuccess /> },
  { path: '/order-cancelled', element: <OrderCancelled /> },
  { path: '/order-status', element: <OrderStatus /> },
  { path: '/waitlist', element: <WaitlistPage /> },
  {
    path: '/admin',
    element: <AdminDashboard />,
    children: [
      { index: true, element: <Navigate to="/admin/orders" replace /> },
      { path: 'orders', element: <AdminOrders /> },
      { path: 'products', element: <AdminProducts /> },
      { path: 'analytics', element: <AdminAnalytics /> },
      { path: 'customers', element: <AdminCustomers /> },
      { path: 'waitlist', element: <AdminWaitlist /> },
      { path: 'pricing', element: <AdminPricing /> },
      { path: 'finish-options', element: <AdminFinishOptions /> },
      { path: 'country-tax', element: <AdminCountryTax /> },
      { path: 'settings', element: <AdminSettings /> },
    ],
  },
]);
