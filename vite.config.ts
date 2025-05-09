import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs-extra';

function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    buildStart() {
      const workerSrc = path.resolve(
        __dirname,
        'node_modules/pdfjs-dist/build/pdf.worker.min.js'
      );
      const workerDest = path.resolve(
        __dirname,
        'public/pdf.worker.min.js'
      );
      fs.copySync(workerSrc, workerDest);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyPdfWorker()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: process.env.ELECTRON_START_URL ? '/' : './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdfjs: ['pdfjs-dist']
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
