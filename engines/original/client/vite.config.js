import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(({ mode }) => ({
  root,
  plugins: [react()],
  define: mode === 'public' ? { 'import.meta.env.VITE_ARENA_MODE': JSON.stringify('browser') } : {},
  worker: { format: 'es' },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } } },
  build: { outDir: path.join(root, mode === 'public' ? 'public-dist' : 'dist'), emptyOutDir: true },
}));
