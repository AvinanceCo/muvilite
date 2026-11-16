/**
 * Vite configuration.
 *
 * Purpose: build config for the admin panel.
 * Inputs:  .env (VITE_API_URL, VITE_MEDIA_URL, VITE_BACKEND_ORIGIN)
 * Outputs: dev server on 5174, dist/ build
 * Deps:    @vitejs/plugin-react, @tailwindcss/vite
 *
 * Port 5174 is not a preference. The backend's CORS allow-list is
 * `[FRONTEND_URL, ADMIN_URL]` (backend/src/app.js) and ADMIN_URL defaults to
 * http://localhost:5174 — any other port is rejected by the browser. 5173
 * belongs to the passenger frontend, which runs alongside this.
 *
 * The dev server proxies /api and /uploads to the backend so the browser sees a
 * single origin, exactly as the frontend does.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BACKEND = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
