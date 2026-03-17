import { createBrowserRouter, Navigate } from 'react-router';
import { CustomerPage } from './pages/CustomerPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminOrders } from './pages/AdminOrders';
import { AdminProducts } from './pages/AdminProducts';
import { AdminSettings } from './pages/AdminSettings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <CustomerPage />,
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