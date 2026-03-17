export interface Product {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  purchasePrice?: number;
  rentalPrice?: number;
  rentalDeposit?: number;
  status: 'available' | 'coming-soon';
}

export interface PreOrder {
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
  paymentMethod: 'mpesa' | 'card';
  orderDate: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

export interface SiteSettings {
  terms: string[];
  engravingPrice: number;
  rentalFixedMonths: number;
}