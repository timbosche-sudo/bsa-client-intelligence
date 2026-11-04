/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Stamps a unique build id into dist/sw.js so each deploy gets a fresh app-shell cache. */
const stampServiceWorker = (): Plugin => ({
  name: 'stamp-service-worker',
  apply: 'build',
  closeBundle() {
    const file = fileURLToPath(new URL('./dist/sw.js', import.meta.url));
    if (existsSync(file)) writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD_ID__', Date.now().toString(36)));
  },
});

// Relative base path so the build works at https://<owner>.github.io/bsa-client-intelligence/
// and from any other sub-path. Routing uses HashRouter, so deep links never 404 on GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), stampServiceWorker()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
