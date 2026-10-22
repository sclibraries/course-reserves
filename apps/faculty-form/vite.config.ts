import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.VITE_BASE_PATH || '/',
    server: {
      host: "::", // Allow external connections
      port: 8080,
      strictPort: false, // Try other ports if 8080 is busy
      fs: {
        allow: [path.resolve(__dirname, './'), path.resolve(__dirname, '../../packages/citations')],
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        '@course-reserves/citations': path.resolve(__dirname, '../../packages/citations/src'),
      },
    },
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
    worker: {
      format: 'es',
    },
  };
});
