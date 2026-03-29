import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: ['subaquatic-tyree-unconfided.ngrok-free.dev'],
    proxy: {
      // REST API
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // WebSocket — proxied through Vite so ngrok tunnel works
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
