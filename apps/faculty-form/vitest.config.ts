/**
 * vitest.config.ts — Vitest configuration for faculty-form.
 *
 * Environment: jsdom so that Zustand's persist middleware (which reads/writes
 * localStorage) works correctly, and any window-level globals in the store
 * (like window.location.href in logout()) are available.
 *
 * Path alias '@' mirrors the vite.config.ts alias for '@/config/endpoints'.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@course-reserves/citations': path.resolve(__dirname, '../../packages/citations/src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, './'), path.resolve(__dirname, '../../packages/citations')],
    },
  },
  // Disable PostCSS when running tests — postcss-selector-parser (a transitive
  // dep of tailwindcss) is not available in the root node_modules and is not
  // needed for unit tests that don't render any CSS.
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.test.{js,jsx,ts,tsx}',
      path.resolve(__dirname, '../../packages/citations/src/**/*.test.ts'),
    ],
  },
});
