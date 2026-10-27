// Public, non-secret frontend configuration. Secrets live only in Nexora-Backend/.env.

// Your app's public Client ID (Dev Dashboard → your app). Not a secret: Shopify requires it in the page.
export const SHOPIFY_API_KEY = '687747fff1ba6b2a7bfcccdfde55f410';


// Nexora backend API. Default is same-origin '/api' (Vite proxies it to Laravel in dev; in
// production the frontend and backend share a host or a gateway routes /api to the backend).
// Overridable at build time with VITE_NEXORA_API_URL (the E2E tests point it at their test server).
export const API_BASE_URL = import.meta.env.VITE_NEXORA_API_URL ?? '/api';
