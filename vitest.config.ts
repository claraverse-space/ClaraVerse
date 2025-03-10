import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    testTimeout: 10000, // Increase timeout to 10 seconds
    environmentOptions: {
      jsdom: {
        resources: 'usable'
      }
    }
  }
});
