import { useState, useEffect } from 'react';
import { PreOrder } from '../types';
import { storage } from '../utils/storage';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Trash2, Eye } from 'lucide-react';

export function AdminOrders() {
  const [orders, setOrders] = useState<PreOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PreOrder | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const loadOrders = () => {
    const loadedOrders = storage.getOrders();
    setOrders(loadedOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = (orderId: string, status: string) => {
    storage.updateOrder(orderId, { status: status as PreOrder['status'] });
    loadOrders();
    toast.success('Order status updated');
  };

  const handleDelete = (orderId: string) => {
    if (confirm('Delete this order?')) {
      storage.deleteOrder(orderId);
      loadOrders();
      toast.success('Order deleted');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl">Pre-Orders ({orders.length})</h2>
      </div>

      {orders.length === 0 ? (
        <div className="border p-12 text-center text-gray-500">
          No pre-orders yet
        </div>
      ) : (
        <div className="border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell className="text-sm">
                    {new Date(order.orderDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{order.customerName}</div>
                      <div className="text-xs text-gray-600">{order.customerPhone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{order.productName}</div>
                    <div className="text-xs text-gray-600">Qty: {order.quantity}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.orderType === 'purchase' ? 'Purchase' : 'Rental'}
                  </TableCell>
                  <TableCell className="text-sm uppercase">
                    {order.paymentMethod || 'M-PESA'}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>KES {order.totalAmount.toLocaleString()}</div>
                      {order.depositAmount && (
                        <div className="text-xs text-gray-600">
                          + {order.depositAmount.toLocaleString()} deposit
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                    >
                      <SelectTrigger className="w-28">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
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
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(order.id)}
                      >
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

      {/* Order Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View detailed information about the order.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Label>Order Date:</Label>
                <span>{new Date(selectedOrder.orderDate).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Product:</Label>
                <span>{selectedOrder.productName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Type:</Label>
                <span>{selectedOrder.orderType === 'purchase' ? 'Purchase' : 'Rental'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Wants Engraving:</Label>
                <span>{selectedOrder.wantsEngraving ? 'Yes' : 'No'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Payment Method:</Label>
                <span className="uppercase">{selectedOrder.paymentMethod || 'M-PESA'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Customer Name:</Label>
                <span>{selectedOrder.customerName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Email:</Label>
                <span className="text-xs">{selectedOrder.customerEmail}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Label>Phone:</Label>
                <span>{selectedOrder.customerPhone}</span>
              </div>
              <div className="col-span-2">
                <Label>Delivery Address:</Label>
                <p className="mt-1 text-gray-700">{selectedOrder.customerAddress}</p>
              </div>
              {selectedOrder.notes && (
                <div className="col-span-2">
                  <Label>Notes:</Label>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{selectedOrder.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-t pt-3">
                <Label>Amount:</Label>
                <span>KES {selectedOrder.totalAmount.toLocaleString()}</span>
              </div>
              {selectedOrder.depositAmount && (
                <div className="grid grid-cols-2 gap-2">
                  <Label>Deposit:</Label>
                  <span>KES {selectedOrder.depositAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 font-medium">
                <Label>Total:</Label>
                <span>KES {((selectedOrder.totalAmount || 0) + (selectedOrder.depositAmount || 0)).toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}