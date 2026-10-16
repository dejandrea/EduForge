import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.jsx'],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
