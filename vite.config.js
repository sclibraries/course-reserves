import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Add base configuration for the /course-reserves path
    base: env.VITE_BASE_PATH || '/course-reserves/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      assetsDir: 'assets' // Vite outputs to /dist/assets/*
    }
  };
});