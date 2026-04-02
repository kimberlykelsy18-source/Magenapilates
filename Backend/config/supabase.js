const { createClient } = require('@supabase/supabase-js');

// Lazy anon client proxy — initialises on first method call
let _anon = null;
function getAnon() {
  if (!_anon) {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set in Backend/.env');
    _anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _anon;
}
const supabase = new Proxy({}, { get(_, p) { return getAnon()[p]; } });

// Lazy service-role client proxy
let _service = null;
function getService() {
  if (!_service) {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set in Backend/.env');
    _service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _service;
}
const serviceSupabase = new Proxy({}, { get(_, p) { return getService()[p]; } });

// createServiceClient kept for paymentCleanup.js compatibility
function createServiceClient() {
  return serviceSupabase;
}

module.exports = { supabase, serviceSupabase, createServiceClient };
