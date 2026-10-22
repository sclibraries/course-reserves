import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: dirname,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(dirname, './src') },
  },
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  test: {
    name: 'browser',
    include: ['src/**/*.browser.test.{jsx,tsx}'],
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
    setupFiles: ['src/test/browser.setup.ts'],
  },
});
