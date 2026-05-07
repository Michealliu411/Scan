import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/production-lines': 'http://localhost:3000',
      '/scanning': 'http://localhost:3000'
    }
  }
});
