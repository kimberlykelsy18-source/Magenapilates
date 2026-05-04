// Centralised API base URL.
// VITE_API_URL is set in .env for local dev and in the deployment platform (Vercel/Railway/Netlify)
// for production. The fallback ensures the live Railway backend is used even if the env var
// is missing from the build.
export const API_URL = (
  import.meta.env.VITE_API_URL || 'https://magenapilates-production.up.railway.app'
).replace(/\/$/, '');
