import { createBrowserRouter, Navigate } from 'react-router';
import { CustomerPage } from './pages/CustomerPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminOrders } from './pages/AdminOrders';
import { AdminProducts } from './pages/AdminProducts';
import { AdminSettings } from './pages/AdminSettings';
import { OrderSuccess } from './pages/OrderSuccess';
import { OrderCancelled } from './pages/OrderCancelled';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <CustomerPage />,
  },
  {
    path: '/order-success',
    element: <OrderSuccess />,
  },
  {
    path: '/order-cancelled',
    element: <OrderCancelled />,
  },
  {
    path: '/admin',
    element: <AdminDashboard />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/orders" replace />,
      },
      {
        path: 'orders',
        element: <AdminOrders />,
      },
      {
        path: 'products',
        element: <AdminProducts />,
      },
      {
        path: 'settings',
        element: <AdminSettings />,
      },
    ],
  },
]);
