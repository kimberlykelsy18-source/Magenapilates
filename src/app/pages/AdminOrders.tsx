import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Trash2, Eye, RefreshCw, Printer, CheckCircle2, XCircle, Download } from 'lucide-react';
import { adminHeaders } from './AdminDashboard';

import { API_URL as API } from '../utils/config';

interface Order {
  id: string;
  order_number: number;
  product_name: string;
  order_type: string;
  quantity: number;
  wants_engraving: boolean;
  engraving_text?: string;
  leather_finish?: string;
  wood_finish?: string;
  height_range?: string;
  context_of_use?: string;
  business_name?: string;
  business_email?: string;
  business_type?: string;
  business_registration_number?: string;
  business_address?: string;
  kra_pin?: string;
  rental_agreement_signed?: boolean;
  rental_agreement_name?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  city_town?: string;
  whatsapp_number?: string;
  customer_country?: string;
  notes?: string;
  total_amount: number;
  deposit_amount: number;
  payment_method: string;
  status: string;
  shipping_status: string;
  created_at: string;
  transaction_id?: string | null;
  payment_reference?: string | null;
}

function toShortId(n: number | undefined) {
  if (!n) return 'PRE-???';
  const letterIndex = Math.floor((n - 1) / 999);
  const numPart = ((n - 1) % 999) + 1;
  const letter = String.fromCharCode(65 + letterIndex);
  return `PRE-${letter}${String(numPart).padStart(3, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  payment_verification_pending: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  payment_verification_pending: 'Verifying Payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; orderId: string; action: 'confirm' | 'fail' } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('order_type', typeFilter);
      const res = await fetch(`${API}/api/admin/orders?${params}`, { headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to load orders');
      setOrders(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [statusFilter, typeFilter]);

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
        method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      toast.success('Order status updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleShippingChange = async (orderId: string, shipping_status: string) => {
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
        method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ shipping_status }),
      });
      if (!res.ok) throw new Error('Failed to update shipping');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, shipping_status } : o));
      toast.success('Shipping updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}/confirm-payment`, {
        method: 'PATCH', headers: adminHeaders(),
      });
      if (!res.ok) throw new Error('Failed to confirm payment');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'confirmed' } : o));
      toast.success('Payment confirmed — confirmation email sent');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleMarkFailed = async (orderId: string) => {
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, {
        method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ status: 'failed' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'failed' } : o));
      toast.success('Order marked as failed');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/api/admin/orders/${orderId}`, { method: 'DELETE', headers: adminHeaders() });
      if (!res.ok) throw new Error('Failed to delete order');
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success('Order deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('order_type', typeFilter);
    window.open(`${API}/api/admin/orders/export?${params}`, '_blank');
  };

  const printOrder = (order: Order) => {
    const shortId = toShortId(order.order_number);
    const total = (Number(order.total_amount) + Number(order.deposit_amount || 0)).toLocaleString();
    const statusLabel = STATUS_LABELS[order.status] || order.status;
    const statusColor = ['confirmed', 'completed'].includes(order.status) ? 'green' : order.status === 'failed' || order.status === 'cancelled' ? 'red' : '#b45309';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Order ${shortId}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#333;padding:32px}
.header{background:#3D3530;color:#EBE6DD;padding:20px 32px;text-align:center;margin-bottom:0}
.header h1{font-size:18px;letter-spacing:4px}
.subheader{background:#6B5C53;color:#EBE6DD;padding:12px 32px;text-align:center;margin-bottom:24px}
.subheader h2{font-size:18px}
.section{margin-bottom:18px}.section-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:8px}
.row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid #f5f5f5}
.label{color:#666}.val{font-weight:500;text-align:right;max-width:55%;word-break:break-all}
.total-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;font-weight:bold;border-top:2px solid #3D3530;margin-top:6px}
.status-badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:bold;color:${statusColor};border:1px solid ${statusColor}}
.footer{margin-top:28px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:14px}
@media print{body{padding:0}}</style></head>
<body>
<div class="header"><h1>MAGENA PILATES</h1></div>
<div class="subheader"><p style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:2px;margin-bottom:3px">Pre-Order Receipt</p><h2>${shortId}</h2></div>
<div class="section"><div class="section-title">Order Details</div>
<div class="row"><span class="label">Order ID</span><span class="val">${shortId}</span></div>
<div class="row"><span class="label">Date</span><span class="val">${new Date(order.created_at).toLocaleString()}</span></div>
<div class="row"><span class="label">Status</span><span class="val"><span class="status-badge">${statusLabel}</span></span></div>
<div class="row"><span class="label">Product</span><span class="val">${order.product_name}</span></div>
<div class="row"><span class="label">Type</span><span class="val" style="text-transform:capitalize">${order.order_type}</span></div>
<div class="row"><span class="label">Quantity</span><span class="val">${order.quantity}</span></div>
${order.leather_finish ? `<div class="row"><span class="label">Leather Finish</span><span class="val">${order.leather_finish}</span></div>` : ''}
${order.wood_finish ? `<div class="row"><span class="label">Wood Finish</span><span class="val">${order.wood_finish}</span></div>` : ''}
${order.engraving_text ? `<div class="row"><span class="label">Engraving</span><span class="val">"${order.engraving_text}"</span></div>` : ''}
${order.height_range ? `<div class="row"><span class="label">Height Range</span><span class="val">${order.height_range}</span></div>` : ''}
${order.context_of_use ? `<div class="row"><span class="label">Context of Use</span><span class="val">${order.context_of_use}</span></div>` : ''}
</div>
${order.order_type === 'rental' ? `
<div class="section"><div class="section-title">Business Details</div>
${order.business_name ? `<div class="row"><span class="label">Business</span><span class="val">${order.business_name}</span></div>` : ''}
${order.business_type ? `<div class="row"><span class="label">Business Type</span><span class="val">${order.business_type}</span></div>` : ''}
${order.business_registration_number ? `<div class="row"><span class="label">Registration No.</span><span class="val">${order.business_registration_number}</span></div>` : ''}
${order.kra_pin ? `<div class="row"><span class="label">KRA PIN</span><span class="val">${order.kra_pin}</span></div>` : ''}
${order.business_address ? `<div class="row"><span class="label">Business Address</span><span class="val">${order.business_address}</span></div>` : ''}
${order.rental_agreement_name ? `<div class="row"><span class="label">Agreement Signed By</span><span class="val">${order.rental_agreement_name}</span></div>` : ''}
</div>` : ''}
<div class="section"><div class="section-title">Customer</div>
<div class="row"><span class="label">Name</span><span class="val">${order.customer_name}</span></div>
<div class="row"><span class="label">Email</span><span class="val">${order.customer_email}</span></div>
<div class="row"><span class="label">Phone</span><span class="val">${order.customer_phone}</span></div>
${order.customer_country ? `<div class="row"><span class="label">Country</span><span class="val">${order.customer_country}</span></div>` : ''}
${order.city_town ? `<div class="row"><span class="label">City / Town</span><span class="val">${order.city_town}</span></div>` : ''}
<div class="row"><span class="label">Delivery Address</span><span class="val">${order.customer_address || '—'}</span></div>
${order.notes ? `<div class="row"><span class="label">Notes</span><span class="val">${order.notes}</span></div>` : ''}
</div>
<div class="section"><div class="section-title">Payment</div>
<div class="row"><span class="label">Method</span><span class="val" style="text-transform:uppercase">${order.payment_method}</span></div>
${order.payment_reference ? `<div class="row"><span class="label">Reference</span><span class="val" style="font-family:monospace">${order.payment_reference}</span></div>` : ''}
<div class="row"><span class="label">Product Amount</span><span class="val">KES ${Number(order.total_amount).toLocaleString()}</span></div>
${order.deposit_amount > 0 ? `<div class="row"><span class="label">Deposit</span><span class="val">KES ${Number(order.deposit_amount).toLocaleString()}</span></div>` : ''}
<div class="total-row"><span>Total Paid</span><span>KES ${total}</span></div>
</div>
<div class="footer"><p>Magena Pilates · Nairobi, Kenya</p><p style="margin-top:3px">Printed on ${new Date().toLocaleString()}</p></div>
</body></html>`;

    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-500">Loading orders...</div>;

  return (
    <div>
      <div className="mb-5 flex justify-between items-center gap-4 flex-wrap">
        <h2 className="text-2xl text-[#3D3530]">Pre-Orders ({orders.length})</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_payment">Pending Payment</SelectItem>
              <SelectItem value="payment_verification_pending">Verifying Payment</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="rental">Rental</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadOrders}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="border p-12 text-center text-gray-500 bg-white">No orders found</div>
      ) : (
        <div className="border overflow-x-auto bg-white">
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
                  <TableCell className="font-mono text-xs text-[#3D3530] font-medium whitespace-nowrap">
                    {toShortId(order.order_number)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                    {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{order.customer_name}</div>
                    <div className="text-xs text-gray-500">{order.customer_country || order.customer_phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{order.product_name}</div>
                    <div className="text-xs text-gray-500">
                      {order.leather_finish && `Leather: ${order.leather_finish}`}
                      {order.wood_finish && ` · Wood: ${order.wood_finish}`}
                      {order.engraving_text && ` · "${order.engraving_text}"`}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{order.order_type}</TableCell>
                  <TableCell className="text-xs uppercase">{order.payment_method}</TableCell>
                  <TableCell>
                    <div className="text-sm">KES {Number(order.total_amount).toLocaleString()}</div>
                    {order.deposit_amount > 0 && <div className="text-xs text-gray-500">+{Number(order.deposit_amount).toLocaleString()} dep.</div>}
                  </TableCell>
                  <TableCell>
                    <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                      <SelectTrigger className="w-36 h-8">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={order.shipping_status || 'pending'} onValueChange={(v) => handleShippingChange(order.id, v)}>
                      <SelectTrigger className="w-28 h-8">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${order.shipping_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
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
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setShowDetails(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                      {order.status === 'payment_verification_pending' && (
                        <>
                          <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => setConfirmDialog({ open: true, orderId: order.id, action: 'confirm' })}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => setConfirmDialog({ open: true, orderId: order.id, action: 'fail' })}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleDelete(order.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.action === 'confirm' ? 'Confirm Payment' : 'Mark as Failed'}</DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === 'confirm'
                ? 'Confirm that payment has been received for this order? The customer will be emailed a confirmation.'
                : 'Mark this payment as failed? The customer will be notified.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button
              className={confirmDialog?.action === 'confirm' ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              onClick={() => {
                if (!confirmDialog) return;
                if (confirmDialog.action === 'confirm') handleConfirmPayment(confirmDialog.orderId);
                else handleMarkFailed(confirmDialog.orderId);
              }}>
              {confirmDialog?.action === 'confirm' ? 'Confirm Payment' : 'Mark as Failed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Order — {selectedOrder && toShortId(selectedOrder.order_number)}</DialogTitle>
            <DialogDescription>Full details for this pre-order.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm overflow-y-auto flex-1 px-1 py-1">
              <div className="grid grid-cols-2 gap-2"><Label>Date:</Label><span>{new Date(selectedOrder.created_at).toLocaleString()}</span></div>
              <div className="grid grid-cols-2 gap-2"><Label>Product:</Label><span>{selectedOrder.product_name}</span></div>
              <div className="grid grid-cols-2 gap-2"><Label>Type:</Label><span className="capitalize">{selectedOrder.order_type}</span></div>
              <div className="grid grid-cols-2 gap-2"><Label>Quantity:</Label><span>{selectedOrder.quantity}</span></div>
              {selectedOrder.leather_finish && <div className="grid grid-cols-2 gap-2"><Label>Leather:</Label><span>{selectedOrder.leather_finish}</span></div>}
              {selectedOrder.wood_finish && <div className="grid grid-cols-2 gap-2"><Label>Wood:</Label><span>{selectedOrder.wood_finish}</span></div>}
              {selectedOrder.engraving_text && <div className="grid grid-cols-2 gap-2"><Label>Engraving:</Label><span>"{selectedOrder.engraving_text}"</span></div>}
              {selectedOrder.height_range && <div className="grid grid-cols-2 gap-2"><Label>Height Range:</Label><span>{selectedOrder.height_range}</span></div>}
              {selectedOrder.context_of_use && <div className="grid grid-cols-2 gap-2"><Label>Context:</Label><span>{selectedOrder.context_of_use}</span></div>}
              {selectedOrder.order_type === 'rental' && (
                <>
                  <div className="border-t pt-2 text-xs font-semibold text-[#3D3530] uppercase tracking-widest">Business Details</div>
                  {selectedOrder.business_name && <div className="grid grid-cols-2 gap-2"><Label>Business Name:</Label><span>{selectedOrder.business_name}</span></div>}
                  {selectedOrder.business_type && <div className="grid grid-cols-2 gap-2"><Label>Business Type:</Label><span>{selectedOrder.business_type}</span></div>}
                  {selectedOrder.business_registration_number && <div className="grid grid-cols-2 gap-2"><Label>Registration No:</Label><span>{selectedOrder.business_registration_number}</span></div>}
                  {selectedOrder.kra_pin && <div className="grid grid-cols-2 gap-2"><Label>KRA PIN:</Label><span>{selectedOrder.kra_pin}</span></div>}
                  {selectedOrder.business_address && <div className="grid grid-cols-2 gap-2"><Label>Business Address:</Label><span>{selectedOrder.business_address}</span></div>}
                  {selectedOrder.business_email && <div className="grid grid-cols-2 gap-2"><Label>Business Email:</Label><span>{selectedOrder.business_email}</span></div>}
                  {selectedOrder.rental_agreement_name && <div className="grid grid-cols-2 gap-2"><Label>Signed by:</Label><span>{selectedOrder.rental_agreement_name} ✓</span></div>}
                </>
              )}
              <div className="border-t pt-2"><div className="text-xs font-semibold text-[#3D3530] uppercase tracking-widest mb-2">Customer</div></div>
              <div className="grid grid-cols-2 gap-2"><Label>Name:</Label><span>{selectedOrder.customer_name}</span></div>
              <div className="grid grid-cols-2 gap-2"><Label>Email:</Label><span className="text-xs break-all">{selectedOrder.customer_email}</span></div>
              <div className="grid grid-cols-2 gap-2"><Label>Phone:</Label><span>{selectedOrder.customer_phone}</span></div>
              {selectedOrder.whatsapp_number && <div className="grid grid-cols-2 gap-2"><Label>WhatsApp:</Label><span>{selectedOrder.whatsapp_number}</span></div>}
              {selectedOrder.customer_country && <div className="grid grid-cols-2 gap-2"><Label>Country:</Label><span>{selectedOrder.customer_country}</span></div>}
              {selectedOrder.city_town && <div className="grid grid-cols-2 gap-2"><Label>City / Town:</Label><span>{selectedOrder.city_town}</span></div>}
              <div><Label>Delivery Address:</Label><p className="mt-1 text-gray-700">{selectedOrder.customer_address || '—'}</p></div>
              {selectedOrder.notes && <div><Label>Notes:</Label><p className="mt-1 text-gray-700 whitespace-pre-wrap">{selectedOrder.notes}</p></div>}
              <div className="border-t pt-2"><div className="text-xs font-semibold text-[#3D3530] uppercase tracking-widest mb-2">Payment</div></div>
              <div className="grid grid-cols-2 gap-2"><Label>Method:</Label><span className="uppercase">{selectedOrder.payment_method}</span></div>
              {selectedOrder.payment_reference && <div className="grid grid-cols-2 gap-2"><Label>Reference:</Label><span className="font-mono text-xs">{selectedOrder.payment_reference}</span></div>}
              <div className="grid grid-cols-2 gap-2"><Label>Amount:</Label><span>KES {Number(selectedOrder.total_amount).toLocaleString()}</span></div>
              {selectedOrder.deposit_amount > 0 && <div className="grid grid-cols-2 gap-2"><Label>Deposit:</Label><span>KES {Number(selectedOrder.deposit_amount).toLocaleString()}</span></div>}
              <div className="grid grid-cols-2 gap-2 font-medium"><Label>Total:</Label><span>KES {(Number(selectedOrder.total_amount) + Number(selectedOrder.deposit_amount || 0)).toLocaleString()}</span></div>
            </div>
          )}
          {selectedOrder && (
            <DialogFooter>
              <Button onClick={() => printOrder(selectedOrder)} variant="outline" className="border-[#3D3530] text-[#3D3530] hover:bg-[#3D3530] hover:text-white">
                <Printer className="h-4 w-4 mr-2" /> Print Receipt
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
