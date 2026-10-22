/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Base public path — matches VITE_BASE_PATH so Vite assets resolve correctly
    base: env.VITE_BASE_PATH || '/course-reserves/',

    plugins: [react()],

    server: {
      host: '::',
      port: 5173,
      fs: {
        allow: [path.resolve(__dirname, './'), path.resolve(__dirname, '../../packages/citations')],
      },
      // Allow HMR to work through the nginx proxy when running inside Docker.
      // Set VITE_HMR_HOST / VITE_HMR_PORT in .env.docker to override.
      hmr: process.env.VITE_HMR_HOST
        ? {
            host: process.env.VITE_HMR_HOST,
            port: process.env.VITE_HMR_PORT
              ? parseInt(process.env.VITE_HMR_PORT)
              : 5173,
          }
        : true,
    },

    css: {
      postcss: './postcss.config.js',
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@course-reserves/citations': path.resolve(__dirname, '../../packages/citations/src'),
      },
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      assetsDir: 'assets',
    },
  };
});
