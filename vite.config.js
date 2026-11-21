import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5180',
      '/runs': 'http://localhost:5180',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
