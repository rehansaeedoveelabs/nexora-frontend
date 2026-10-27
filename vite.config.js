import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

// Shopify loads the app in an iframe inside the admin. Browsers only allow that if the page sends
// a Content-Security-Policy `frame-ancestors` naming the admin + the shop. Without it the frame
// shows "refused to connect". (Production sets this per-shop; this is the dev-wide equivalent.)
const shopifyEmbed = {
  name: 'nexora-shopify-embed-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        'frame-ancestors https://admin.shopify.com https://*.myshopify.com;',
      );
      next();
    });
  },
};

export default defineConfig({
  plugins: [reactRouter(), shopifyEmbed],
  server: {
    port: 5173,
    // One public tunnel: Vite serves the app and proxies the API to Laravel, so the whole app
    // (UI, API calls, webhooks) is one origin. No CORS, no second tunnel.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
    // Shopify loads the app through the ngrok/cloudflare tunnel; allow those hosts.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io', '.trycloudflare.com', 'localhost', '127.0.0.1'],
  },
});
