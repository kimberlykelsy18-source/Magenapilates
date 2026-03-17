export type Currency = 'KES' | 'TZS' | 'UGX' | 'SOS' | 'ETB' | 'BIF' | 'RWF' | 'SDG' | 'SSP';

export interface CurrencyInfo {
  code: Currency;
  name: string;
  country: string;
  symbol: string;
  rateFromKES: number; // How much of this currency equals 1 KES
}

// Exchange rates relative to KES (Kenyan Shilling) - approximations as of 2026
export const currencies: Record<Currency, CurrencyInfo> = {
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    country: 'Kenya',
    symbol: 'KES',
    rateFromKES: 1,
  },
  TZS: {
    code: 'TZS',
    name: 'Tanzanian Shilling',
    country: 'Tanzania',
    symbol: 'TZS',
    rateFromKES: 19.5, // 1 KES ≈ 19.5 TZS
  },
  UGX: {
    code: 'UGX',
    name: 'Ugandan Shilling',
    country: 'Uganda',
    symbol: 'UGX',
    rateFromKES: 28.5, // 1 KES ≈ 28.5 UGX
  },
  SOS: {
    code: 'SOS',
    name: 'Somali Shilling',
    country: 'Somalia',
    symbol: 'SOS',
    rateFromKES: 4.4, // 1 KES ≈ 4.4 SOS
  },
  ETB: {
    code: 'ETB',
    name: 'Ethiopian Birr',
    country: 'Ethiopia',
    symbol: 'ETB',
    rateFromKES: 0.95, // 1 KES ≈ 0.95 ETB
  },
  BIF: {
    code: 'BIF',
    name: 'Burundian Franc',
    country: 'Burundi',
    symbol: 'BIF',
    rateFromKES: 22.5, // 1 KES ≈ 22.5 BIF
  },
  RWF: {
    code: 'RWF',
    name: 'Rwandan Franc',
    country: 'Rwanda',
    symbol: 'RWF',
    rateFromKES: 10.5, // 1 KES ≈ 10.5 RWF
  },
  SDG: {
    code: 'SDG',
    name: 'Sudanese Pound',
    country: 'Sudan',
    symbol: 'SDG',
    rateFromKES: 4.6, // 1 KES ≈ 4.6 SDG
  },
  SSP: {
    code: 'SSP',
    name: 'South Sudanese Pound',
    country: 'South Sudan',
    symbol: 'SSP',
    rateFromKES: 1.0, // 1 KES ≈ 1.0 SSP
  },
};

export const convertPrice = (priceInKES: number, targetCurrency: Currency): number => {
  const rate = currencies[targetCurrency].rateFromKES;
  return Math.round(priceInKES * rate);
};

export const formatPrice = (price: number, currency: Currency): string => {
  const currencyInfo = currencies[currency];
  return `${currencyInfo.symbol} ${price.toLocaleString()}`;
};
