// Public, non-secret frontend configuration. Secrets live only in Nexora-Backend/.env.

// Your app's public Client ID (Dev Dashboard → your app). Not a secret: Shopify requires it in the page.
export const SHOPIFY_API_KEY = 'REPLACE_WITH_SHOPIFY_API_KEY';

// Nexora backend API (no trailing slash). Can be overridden at build time with VITE_NEXORA_API_URL
// (the E2E tests use this to point at their test server).
export const API_BASE_URL = import.meta.env.VITE_NEXORA_API_URL ?? 'https://nexora-backend.test/api';
