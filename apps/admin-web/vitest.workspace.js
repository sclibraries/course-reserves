import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Two projects:
//   - `unit`      → jsdom + React, runs src/**/*.test.* (run via `npm run test`,
//                   i.e. `vitest --project unit`). This is what CI/devs run.
//   - `storybook` → Playwright/Chromium browser tests for stories
//                   (run via `npm run test:storybook`). Requires a browser.
//
// NOTE: this file uses the `defineWorkspace` API because the installed Vitest
// (3.0.x) does not yet support `test.projects` in a plain config — that arrived
// in 3.2. Selecting `--project unit` means the storybook project's plugins are
// never built, so its browser/Storybook setup can't break the unit run.
export default defineWorkspace([
  {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
      },
    },
    // Override PostCSS so Vite doesn't load postcss.config.js. postcss-import
    // (used there) requires 'resolve', which lives in admin-web's own
    // node_modules but not the workspace-root node_modules used when running
    // tests from the monorepo root via `npm run test -w course-reserves`.
    css: {
      postcss: {
        plugins: [],
      },
    },
    test: {
      name: 'unit',
      root: dirname,
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    },
  },
  {
    extends: 'vite.config.js',
    plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
      storybookTest({ configDir: path.join(dirname, '.storybook') }),
    ],
    test: {
      name: 'storybook',
      browser: {
        enabled: true,
        headless: true,
        name: 'chromium',
        provider: 'playwright',
      },
      setupFiles: ['.storybook/vitest.setup.js'],
    },
  },
]);
