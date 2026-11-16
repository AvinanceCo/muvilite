/**
 * Vite configuration.
 *
 * Purpose: build config for the passenger frontend.
 * Inputs:  .env (VITE_API_URL, VITE_MEDIA_URL)
 * Outputs: dev server on 5173 (already in the backend CORS allow-list), dist/ build
 * Deps:    @vitejs/plugin-react, @tailwindcss/vite
 *
 * The dev server proxies /api and /uploads to the backend so the browser sees a
 * single origin during development. In production the two are served from the
 * same host, matching how the legacy app served /api/v2 and /assets.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BACKEND = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
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
