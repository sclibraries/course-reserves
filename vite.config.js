import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Add base configuration for the /course-reserves path
  base: '/course-reserves/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets' // Vite outputs to /dist/assets/*
  }
});