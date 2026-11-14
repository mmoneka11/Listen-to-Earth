import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/manifest.json': 'http://127.0.0.1:8000',
      '/features': 'http://127.0.0.1:8000',
      '/frames': 'http://127.0.0.1:8000',
      '/audio': 'http://127.0.0.1:8000',
      '/public': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
    },
  },
});
