/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, 'src/common'),
      '@modules': path.resolve(__dirname, 'src/modules'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Ensure each test file gets a clean module cache
    // to avoid cross-test pollution from vi.mock
    // Uncomment if needed: pool: 'forks',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
      DATABASE_URL: 'file:./test.db',
      PORT: '0',
    },
    // Increase timeout for integration tests
    testTimeout: 15000,
  },
});
