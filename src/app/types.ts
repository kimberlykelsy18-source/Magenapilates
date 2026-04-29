export interface Product {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  purchasePrice?: number;
  rentalPrice?: number;
  rentalDeposit?: number;
  usdPrice?: number;
  hasHeightSizing?: boolean;
  leatherFinishes?: string[];
  woodFinishes?: string[];
  status: 'available' | 'coming-soon';
}

export interface PreOrder {
  id: string;
  productId: string;
  productName: string;
  orderType: 'purchase' | 'rental';
  quantity: number;
  wantsEngraving: boolean;
  engravingText?: string;
  leatherFinish?: string;
  woodFinish?: string;
  heightRange?: string;
  contextOfUse?: string;
  businessName?: string;
  businessEmail?: string;
  businessType?: string;
  businessRegistrationNumber?: string;
  businessAddress?: string;
  kraPin?: string;
  rentalAgreementSigned?: boolean;
  rentalAgreementName?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  cityTown?: string;
  whatsappNumber?: string;
  customerCountry?: string;
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
  exchangeRate?: number;
  rentalDepositFormula?: string;
  instagramUrl?: string;
  pinterestUrl?: string;
  whatsappNumber?: string;
  footerDisclaimer?: string;
  postOrderMessage?: string;
  waitlistMessage?: string;
  leatherFinishes?: string[];
  woodFinishes?: string[];
}

export interface CountrySettings {
  country_name: string;
  country_code: string;
  vat_rate: number;
  tax_label: string;
  delivery_timeline: string;
  currency_code: string;
  currency_name: string;
  rental_available: boolean;
}
