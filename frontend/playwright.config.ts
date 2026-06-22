import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests/smoke'),
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.resolve(__dirname, '../docs/smoke-evidence/playwright-report'), open: 'never' }],
    ['json', { outputFile: path.resolve(__dirname, '../docs/smoke-evidence/playwright-results.json') }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'bash ../scripts/start-browser-smoke-server.sh',
    url: 'http://127.0.0.1:5173/login',
    cwd: __dirname,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  outputDir: path.resolve(__dirname, '../docs/smoke-evidence/test-results'),
});
