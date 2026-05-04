'use strict';
const express = require('express');
const requireAdmin = require('../middleware/auth');

module.exports = ({ supabase, serviceSupabase }) => {
  const router = express.Router();

  // Public — list all products (cached 5 min)
  router.get('/api/products', async (_req, res) => {
    const { data, error } = await supabase
      .from('products').select('*').order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.json(data);
  });

  // Admin — create product
  router.post('/api/admin/products', requireAdmin, async (req, res) => {
    const { name, description, image_url, purchase_price, rental_price, rental_deposit, status,
      usd_price, has_height_sizing, leather_finishes, wood_finishes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await serviceSupabase
      .from('products')
      .insert({ name, description, image_url, purchase_price, rental_price, rental_deposit,
        status: status || 'available', usd_price, has_height_sizing: has_height_sizing || false,
        leather_finishes, wood_finishes })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  // Admin — update product (partial: only updates fields present in the request body)
  router.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const ALLOWED = ['name', 'description', 'image_url', 'purchase_price', 'rental_price',
      'rental_deposit', 'status', 'usd_price', 'has_height_sizing', 'leather_finishes', 'wood_finishes'];
    const updates = {};
    for (const field of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });

    const { data, error } = await serviceSupabase
      .from('products')
      .update(updates)
      .eq('id', id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  });

  // Admin — delete product
  router.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await serviceSupabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  return router;
};
