'use strict';
const express = require('express');
const requireAdmin = require('../middleware/auth');

const DEFAULT_COUNTRIES = [
  { country_name: 'Kenya', country_code: 'KE', vat_rate: 16, tax_label: 'VAT', delivery_timeline: '2–4 weeks', currency_code: 'KES', currency_name: 'Kenyan Shilling', rental_available: true },
  { country_name: 'United States', country_code: 'US', vat_rate: 0, tax_label: 'Tax', delivery_timeline: '6–8 weeks', currency_code: 'USD', currency_name: 'US Dollar', rental_available: false },
  { country_name: 'United Kingdom', country_code: 'GB', vat_rate: 20, tax_label: 'VAT', delivery_timeline: '6–8 weeks', currency_code: 'GBP', currency_name: 'British Pound', rental_available: false },
  { country_name: 'Germany', country_code: 'DE', vat_rate: 19, tax_label: 'MwSt', delivery_timeline: '6–8 weeks', currency_code: 'EUR', currency_name: 'Euro', rental_available: false },
  { country_name: 'France', country_code: 'FR', vat_rate: 20, tax_label: 'TVA', delivery_timeline: '6–8 weeks', currency_code: 'EUR', currency_name: 'Euro', rental_available: false },
  { country_name: 'Italy', country_code: 'IT', vat_rate: 22, tax_label: 'IVA', delivery_timeline: '6–8 weeks', currency_code: 'EUR', currency_name: 'Euro', rental_available: false },
  { country_name: 'Spain', country_code: 'ES', vat_rate: 21, tax_label: 'IVA', delivery_timeline: '6–8 weeks', currency_code: 'EUR', currency_name: 'Euro', rental_available: false },
  { country_name: 'Netherlands', country_code: 'NL', vat_rate: 21, tax_label: 'BTW', delivery_timeline: '6–8 weeks', currency_code: 'EUR', currency_name: 'Euro', rental_available: false },
  { country_name: 'Australia', country_code: 'AU', vat_rate: 10, tax_label: 'GST', delivery_timeline: '8–10 weeks', currency_code: 'AUD', currency_name: 'Australian Dollar', rental_available: false },
  { country_name: 'Canada', country_code: 'CA', vat_rate: 5, tax_label: 'GST', delivery_timeline: '6–8 weeks', currency_code: 'CAD', currency_name: 'Canadian Dollar', rental_available: false },
  { country_name: 'India', country_code: 'IN', vat_rate: 18, tax_label: 'GST', delivery_timeline: '6–10 weeks', currency_code: 'INR', currency_name: 'Indian Rupee', rental_available: false },
  { country_name: 'Japan', country_code: 'JP', vat_rate: 10, tax_label: 'Consumption Tax', delivery_timeline: '8–10 weeks', currency_code: 'JPY', currency_name: 'Japanese Yen', rental_available: false },
  { country_name: 'Singapore', country_code: 'SG', vat_rate: 9, tax_label: 'GST', delivery_timeline: '6–8 weeks', currency_code: 'SGD', currency_name: 'Singapore Dollar', rental_available: false },
  { country_name: 'United Arab Emirates', country_code: 'AE', vat_rate: 5, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'AED', currency_name: 'UAE Dirham', rental_available: false },
  { country_name: 'South Africa', country_code: 'ZA', vat_rate: 15, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'ZAR', currency_name: 'South African Rand', rental_available: false },
  { country_name: 'Nigeria', country_code: 'NG', vat_rate: 7.5, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'NGN', currency_name: 'Nigerian Naira', rental_available: false },
  { country_name: 'Ghana', country_code: 'GH', vat_rate: 15, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'GHS', currency_name: 'Ghanaian Cedi', rental_available: false },
  { country_name: 'Tanzania', country_code: 'TZ', vat_rate: 18, tax_label: 'VAT', delivery_timeline: '2–4 weeks', currency_code: 'TZS', currency_name: 'Tanzanian Shilling', rental_available: false },
  { country_name: 'Uganda', country_code: 'UG', vat_rate: 18, tax_label: 'VAT', delivery_timeline: '2–4 weeks', currency_code: 'UGX', currency_name: 'Ugandan Shilling', rental_available: false },
  { country_name: 'Rwanda', country_code: 'RW', vat_rate: 18, tax_label: 'VAT', delivery_timeline: '2–4 weeks', currency_code: 'RWF', currency_name: 'Rwandan Franc', rental_available: false },
  { country_name: 'Ethiopia', country_code: 'ET', vat_rate: 15, tax_label: 'VAT', delivery_timeline: '3–5 weeks', currency_code: 'ETB', currency_name: 'Ethiopian Birr', rental_available: false },
  { country_name: 'Egypt', country_code: 'EG', vat_rate: 14, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'EGP', currency_name: 'Egyptian Pound', rental_available: false },
  { country_name: 'Morocco', country_code: 'MA', vat_rate: 20, tax_label: 'TVA', delivery_timeline: '4–6 weeks', currency_code: 'MAD', currency_name: 'Moroccan Dirham', rental_available: false },
  { country_name: 'Senegal', country_code: 'SN', vat_rate: 18, tax_label: 'TVA', delivery_timeline: '4–6 weeks', currency_code: 'XOF', currency_name: 'West African CFA Franc', rental_available: false },
  { country_name: 'Ivory Coast', country_code: 'CI', vat_rate: 18, tax_label: 'TVA', delivery_timeline: '4–6 weeks', currency_code: 'XOF', currency_name: 'West African CFA Franc', rental_available: false },
  { country_name: 'Cameroon', country_code: 'CM', vat_rate: 19.25, tax_label: 'TVA', delivery_timeline: '4–6 weeks', currency_code: 'XAF', currency_name: 'Central African CFA Franc', rental_available: false },
  { country_name: 'Zimbabwe', country_code: 'ZW', vat_rate: 15, tax_label: 'VAT', delivery_timeline: '3–5 weeks', currency_code: 'USD', currency_name: 'US Dollar', rental_available: false },
  { country_name: 'Zambia', country_code: 'ZM', vat_rate: 16, tax_label: 'VAT', delivery_timeline: '3–5 weeks', currency_code: 'ZMW', currency_name: 'Zambian Kwacha', rental_available: false },
  { country_name: 'Botswana', country_code: 'BW', vat_rate: 14, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'BWP', currency_name: 'Botswana Pula', rental_available: false },
  { country_name: 'Namibia', country_code: 'NA', vat_rate: 15, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'NAD', currency_name: 'Namibian Dollar', rental_available: false },
  { country_name: 'China', country_code: 'CN', vat_rate: 13, tax_label: 'VAT', delivery_timeline: '8–12 weeks', currency_code: 'CNY', currency_name: 'Chinese Yuan', rental_available: false },
  { country_name: 'South Korea', country_code: 'KR', vat_rate: 10, tax_label: 'VAT', delivery_timeline: '8–10 weeks', currency_code: 'KRW', currency_name: 'South Korean Won', rental_available: false },
  { country_name: 'Brazil', country_code: 'BR', vat_rate: 17, tax_label: 'ICMS', delivery_timeline: '8–12 weeks', currency_code: 'BRL', currency_name: 'Brazilian Real', rental_available: false },
  { country_name: 'Mexico', country_code: 'MX', vat_rate: 16, tax_label: 'IVA', delivery_timeline: '8–10 weeks', currency_code: 'MXN', currency_name: 'Mexican Peso', rental_available: false },
  { country_name: 'New Zealand', country_code: 'NZ', vat_rate: 15, tax_label: 'GST', delivery_timeline: '8–10 weeks', currency_code: 'NZD', currency_name: 'New Zealand Dollar', rental_available: false },
  { country_name: 'Sweden', country_code: 'SE', vat_rate: 25, tax_label: 'MOMS', delivery_timeline: '6–8 weeks', currency_code: 'SEK', currency_name: 'Swedish Krona', rental_available: false },
  { country_name: 'Norway', country_code: 'NO', vat_rate: 25, tax_label: 'MVA', delivery_timeline: '6–8 weeks', currency_code: 'NOK', currency_name: 'Norwegian Krone', rental_available: false },
  { country_name: 'Switzerland', country_code: 'CH', vat_rate: 8.1, tax_label: 'MWST', delivery_timeline: '6–8 weeks', currency_code: 'CHF', currency_name: 'Swiss Franc', rental_available: false },
  { country_name: 'Saudi Arabia', country_code: 'SA', vat_rate: 15, tax_label: 'VAT', delivery_timeline: '4–6 weeks', currency_code: 'SAR', currency_name: 'Saudi Riyal', rental_available: false },
  { country_name: 'Qatar', country_code: 'QA', vat_rate: 0, tax_label: 'Tax', delivery_timeline: '4–6 weeks', currency_code: 'QAR', currency_name: 'Qatari Riyal', rental_available: false },
  { country_name: 'Turkey', country_code: 'TR', vat_rate: 20, tax_label: 'KDV', delivery_timeline: '6–8 weeks', currency_code: 'TRY', currency_name: 'Turkish Lira', rental_available: false },
];

module.exports = ({ serviceSupabase }) => {
  const router = express.Router();

  // GET /api/settings/countries — public, used by order form
  router.get('/api/settings/countries', async (_req, res) => {
    const { data, error } = await serviceSupabase
      .from('country_settings')
      .select('country_name, country_code, vat_rate, tax_label, delivery_timeline, currency_code, currency_name, rental_available')
      .order('country_name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.json(DEFAULT_COUNTRIES);
    res.json(data);
  });

  // GET /api/admin/country-tax
  router.get('/api/admin/country-tax', requireAdmin, async (_req, res) => {
    const { data, error } = await serviceSupabase
      .from('country_settings').select('*').order('country_name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // POST /api/admin/country-tax — add a country
  router.post('/api/admin/country-tax', requireAdmin, async (req, res) => {
    const { country_name, country_code, vat_rate, tax_label, delivery_timeline, currency_code, currency_name, rental_available } = req.body;
    if (!country_name || !country_code) return res.status(400).json({ error: 'country_name and country_code are required' });

    const { data, error } = await serviceSupabase
      .from('country_settings')
      .insert({ country_name, country_code: country_code.toUpperCase(), vat_rate: vat_rate || 0, tax_label, delivery_timeline, currency_code, currency_name, rental_available: rental_available || false })
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Country code already exists' });
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
  });

  // PUT /api/admin/country-tax/:code
  router.put('/api/admin/country-tax/:code', requireAdmin, async (req, res) => {
    const { code } = req.params;
    const { country_name, vat_rate, tax_label, delivery_timeline, currency_code, currency_name, rental_available } = req.body;

    const { data, error } = await serviceSupabase
      .from('country_settings')
      .update({ country_name, vat_rate, tax_label, delivery_timeline, currency_code, currency_name, rental_available })
      .eq('country_code', code.toUpperCase())
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Country not found' });
    res.json(data);
  });

  // DELETE /api/admin/country-tax/:code
  router.delete('/api/admin/country-tax/:code', requireAdmin, async (req, res) => {
    const { code } = req.params;
    const { error } = await serviceSupabase
      .from('country_settings').delete().eq('country_code', code.toUpperCase());
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // POST /api/admin/country-tax/seed — load defaults
  router.post('/api/admin/country-tax/seed', requireAdmin, async (_req, res) => {
    const { error } = await serviceSupabase
      .from('country_settings').upsert(DEFAULT_COUNTRIES, { onConflict: 'country_code' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: DEFAULT_COUNTRIES.length });
  });

  return router;
};
