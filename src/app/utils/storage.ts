import { Product, PreOrder, SiteSettings } from '../types';

const PRODUCTS_KEY = 'magena_products';
const ORDERS_KEY = 'magena_orders';
const SETTINGS_KEY = 'magena_settings';
const DATA_VERSION_KEY = 'magena_data_version';
const CURRENT_DATA_VERSION = '7'; // Increment this to force data refresh

const defaultSettings: SiteSettings = {
  terms: [
    'Current prices are pre-order prices only. Prices will change after pre-order period.',
    'Rentals: Pay Deposit + Monthly Rent (deposit is refundable if equipment returned without damage)',
    'Pre-order rental price stays fixed for first 5 months, then standard rental price applies',
    'FREE logo engraving during pre-order period (KES 3,500 after pre-order closes)',
    'All prices apply per equipment'
  ],
  engravingPrice: 3500,
  rentalFixedMonths: 5
};

export const storage = {
  // Products
  getProducts: (): Product[] => {
    const data = localStorage.getItem(PRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveProducts: (products: Product[]) => {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  // Orders
  getOrders: (): PreOrder[] => {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveOrders: (orders: PreOrder[]) => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  },

  addOrder: (order: PreOrder) => {
    const orders = storage.getOrders();
    orders.push(order);
    storage.saveOrders(orders);
  },

  updateOrder: (id: string, updates: Partial<PreOrder>) => {
    const orders = storage.getOrders();
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      storage.saveOrders(orders);
    }
  },

  deleteOrder: (id: string) => {
    const orders = storage.getOrders();
    storage.saveOrders(orders.filter(o => o.id !== id));
  },

  // Settings
  getSettings: (): SiteSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : defaultSettings;
  },

  saveSettings: (settings: SiteSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  // Data Version
  getDataVersion: (): string => {
    const data = localStorage.getItem(DATA_VERSION_KEY);
    return data ? data : '1';
  },

  saveDataVersion: (version: string) => {
    localStorage.setItem(DATA_VERSION_KEY, version);
  },

  isDataVersionCurrent: (): boolean => {
    return storage.getDataVersion() === CURRENT_DATA_VERSION;
  },

  refreshData: () => {
    storage.saveDataVersion(CURRENT_DATA_VERSION);
    storage.saveProducts([]);
    storage.saveOrders([]);
    storage.saveSettings(defaultSettings);
  }
};