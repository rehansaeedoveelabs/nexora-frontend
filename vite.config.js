import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 5173,
    // Shopify admin loads the dev server through a tunnel (e.g. cloudflared), so accept its host.
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1'],
  },
});
