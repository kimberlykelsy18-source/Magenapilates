import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Trash2, Eye, RefreshCw, Printer } from 'lucide-react';
import { adminHeaders } from './AdminDashboard';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Order {
  id: string;
  order_number: number;
  product_name: string;
  order_type: string;
  quantity: number;
  wants_engraving: boolean;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  notes?: string;
  total_amount: number;
  deposit_amount: number;
  payment_method: string;
  status: string;
  shipping_status: string;
  created_at: string;
  pesapal_tracking_id?: string | null;
  payment_reference?: string | null;
}

function toShortId(n: number | undefined) {
  if (!n) return 'PRE-???';
  const letterIndex = Math.floor((n - 1) / 999);
  const numPart = ((n - 1) % 999) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending_payment': return 'bg-yellow-100 text-yellow-800';
    case 'confirmed': return 'bg-blue-100 text-blue-800';
    case 'failed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getShippingColor(shipping: string) {
  return shipping === 'completed'
    ? 'bg-green-100 text-green-800'
    : 'bg-orange-100 text-orange-800';
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = async (status?: string) => {
    setLoading(true);
    try {
      const url = status && status !== 'all'
        ? `${API}/api/admin/orders?status=${status}`
        : `${API}/api/admin/orders`;
      const res = await fetch(url, { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    loadOrders(value);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      toast.success('Order status updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleShippingChange = async (orderId: string, shipping_status: string) => {
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ shipping_status }),
      });
      if (!res.ok) throw new Error('Failed to update shipping');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, shipping_status } : o));
      toast.success('Shipping status updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update shipping');
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete order');
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success('Order deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete order');
    }
  };

  const printOrder = (order: Order) => {
    const shortId = toShortId(order.order_number);
    const total = (Number(order.total_amount) + Number(order.deposit_amount || 0)).toLocaleString();
    const statusLabel = order.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const statusColor = order.status === 'confirmed' || order.status === 'completed' ? 'green' : order.status === 'cancelled' ? 'red' : '#b45309';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Order ${shortId} — Magena Pilates</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #333; background: #fff; padding: 32px; }
    .header { background: #3D3530; color: #EBE6DD; padding: 24px 32px; text-align: center; margin-bottom: 0; }
    .header h1 { font-size: 20px; letter-spacing: 4px; }
    .subheader { background: #6B5C53; color: #EBE6DD; padding: 14px 32px; text-align: center; margin-bottom: 24px; }
    .subheader p { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .subheader h2 { font-size: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid #f5f5f5; }
    .row .label { color: #666; }
    .row .val { font-weight: 500; text-align: right; max-width: 60%; word-break: break-all; }
    .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; font-weight: bold; border-top: 2px solid #3D3530; margin-top: 8px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; color: ${statusColor}; border: 1px solid ${statusColor}; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header"><h1>MAGENA PILATES</h1></div>
  <div class="subheader"><p>Pre-Order Receipt</p><h2>${shortId}</h2></div>

  <div class="section">
    <div class="section-title">Order Details</div>
    <div class="row"><span class="label">Order ID</span><span class="val">${shortId}</span></div>
    <div class="row"><span class="label">Date</span><span class="val">${new Date(order.created_at).toLocaleString()}</span></div>
    <div class="row"><span class="label">Status</span><span class="val"><span class="status-badge">${statusLabel}</span></span></div>
    <div class="row"><span class="label">Shipping</span><span class="val">${order.shipping_status === 'completed' ? 'Shipped' : 'Pending'}</span></div>
    <div class="row"><span class="label">Product</span><span class="val">${order.product_name}</span></div>
    <div class="row"><span class="label">Order Type</span><span class="val" style="text-transform:capitalize">${order.order_type}</span></div>
    <div class="row"><span class="label">Quantity</span><span class="val">${order.quantity}</span></div>
    ${order.wants_engraving ? '<div class="row"><span class="label">Engraving</span><span class="val">FREE Logo Engraving</span></div>' : ''}
  </div>

  <div class="section">
    <div class="section-title">Customer</div>
    <div class="row"><span class="label">Name</span><span class="val">${order.customer_name}</span></div>
    <div class="row"><span class="label">Email</span><span class="val">${order.customer_email}</span></div>
    <div class="row"><span class="label">Phone</span><span class="val">${order.customer_phone}</span></div>
    <div class="row"><span class="label">Delivery Address</span><span class="val">${order.customer_address || '—'}</span></div>
    ${order.notes ? `<div class="row"><span class="label">Notes</span><span class="val">${order.notes}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Payment</div>
    <div class="row"><span class="label">Method</span><span class="val" style="text-transform:uppercase">${order.payment_method}</span></div>
    ${order.payment_reference ? `<div class="row"><span class="label">Payment Ref</span><span class="val" style="font-family:monospace">${order.payment_reference}</span></div>` : ''}
    ${order.pesapal_tracking_id ? `<div class="row"><span class="label">Transaction ID</span><span class="val" style="font-family:monospace;font-size:11px">${order.pesapal_tracking_id}</span></div>` : ''}
    <div class="row"><span class="label">Product Amount</span><span class="val">KES ${Number(order.total_amount).toLocaleString()}</span></div>
    ${order.deposit_amount > 0 ? `<div class="row"><span class="label">Deposit</span><span class="val">KES ${Number(order.deposit_amount).toLocaleString()}</span></div>` : ''}
    <div class="total-row"><span>Total Paid</span><span>KES ${total}</span></div>
  </div>

  <div class="footer">
    <p>Magena Pilates · Nairobi, Kenya</p>
    <p style="margin-top:4px">Printed on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        Loading orders...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center gap-4">
        <h2 className="text-2xl">Pre-Orders ({orders.length})</h2>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_payment">Pending Payment</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => loadOrders(statusFilter)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="border p-12 text-center text-gray-500">No pre-orders yet</div>
      ) : (
        <div className="border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shipping</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs text-[#3D3530] font-medium">
                    {toShortId(order.order_number)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{order.customer_name}</div>
                      <div className="text-xs text-gray-600">{order.customer_phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{order.product_name}</div>
                    <div className="text-xs text-gray-600">Qty: {order.quantity}</div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{order.order_type}</TableCell>
                  <TableCell className="text-sm uppercase">{order.payment_method}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>KES {Number(order.total_amount).toLocaleString()}</div>
                      {order.deposit_amount > 0 && (
                        <div className="text-xs text-gray-600">
                          + {Number(order.deposit_amount).toLocaleString()} deposit
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                    >
                      <SelectTrigger className="w-36">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending_payment">Pending Payment</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.shipping_status || 'pending'}
                      onValueChange={(value) => handleShippingChange(order.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <span className={`text-xs px-2 py-1 rounded ${getShippingColor(order.shipping_status || 'pending')}`}>
                          {order.shipping_status === 'completed' ? 'Shipped' : 'Pending'}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Shipped</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelectedOrder(order); setShowDetails(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(order.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Order Details — {selectedOrder && toShortId(selectedOrder.order_number)}</DialogTitle>
            <DialogDescription>Full details for this pre-order.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm overflow-y-auto flex-1 px-6 py-4">
              <div className="grid grid-cols-2 gap-2">
                <Label>Order Date:</Label>
                <span>{new Date(selectedOrder.created_at).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Product:</Label>
                <span>{selectedOrder.product_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Type:</Label>
                <span className="capitalize">{selectedOrder.order_type}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Quantity:</Label>
                <span>{selectedOrder.quantity}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Engraving:</Label>
                <span>{selectedOrder.wants_engraving ? 'Yes (FREE)' : 'No'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Payment Method:</Label>
                <span className="uppercase">{selectedOrder.payment_method}</span>
              </div>
              {selectedOrder.pesapal_tracking_id && (
                <div className="grid grid-cols-2 gap-2">
                  <Label>Transaction ID:</Label>
                  <span className="font-mono text-xs break-all">{selectedOrder.pesapal_tracking_id}</span>
                </div>
              )}
              {selectedOrder.payment_reference && (
                <div className="grid grid-cols-2 gap-2">
                  <Label>Payment Ref:</Label>
                  <span className="font-mono font-medium">{selectedOrder.payment_reference}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Label>Shipping:</Label>
                <span className={`text-xs px-2 py-1 rounded w-fit ${getShippingColor(selectedOrder.shipping_status || 'pending')}`}>
                  {selectedOrder.shipping_status === 'completed' ? 'Shipped' : 'Pending'}
                </span>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-2">
                <Label>Customer Name:</Label>
                <span>{selectedOrder.customer_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Email:</Label>
                <span className="text-xs break-all">{selectedOrder.customer_email}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Phone:</Label>
                <span>{selectedOrder.customer_phone}</span>
              </div>
              <div>
                <Label>Delivery Address:</Label>
                <p className="mt-1 text-gray-700">{selectedOrder.customer_address || '—'}</p>
              </div>
              {selectedOrder.notes && (
                <div>
                  <Label>Notes:</Label>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{selectedOrder.notes}</p>
                </div>
              )}
              <div className="border-t pt-3 grid grid-cols-2 gap-2">
                <Label>Product Amount:</Label>
                <span>KES {Number(selectedOrder.total_amount).toLocaleString()}</span>
              </div>
              {selectedOrder.deposit_amount > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <Label>Deposit:</Label>
                  <span>KES {Number(selectedOrder.deposit_amount).toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 font-medium">
                <Label>Total Paid:</Label>
                <span>KES {(Number(selectedOrder.total_amount) + Number(selectedOrder.deposit_amount || 0)).toLocaleString()}</span>
              </div>
            </div>
          )}
          {selectedOrder && (
            <DialogFooter>
              <Button
                onClick={() => printOrder(selectedOrder)}
                variant="outline"
                className="border-[#3D3530] text-[#3D3530] hover:bg-[#3D3530] hover:text-white"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Order Receipt
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
