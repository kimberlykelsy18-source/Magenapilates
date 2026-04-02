import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Trash2, Eye, RefreshCw } from 'lucide-react';
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
  created_at: string;
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
    case 'completed': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
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
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
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
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details — {selectedOrder && toShortId(selectedOrder.order_number)}</DialogTitle>
            <DialogDescription>Full details for this pre-order.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
