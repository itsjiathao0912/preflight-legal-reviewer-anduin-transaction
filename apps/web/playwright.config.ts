import { defineConfig, devices } from '@playwright/test';

// `stack` = built SPA + Worker /api/* served together by `wrangler dev` (pnpm dev:stack).
const STACK_URL = 'http://127.0.0.1:8787';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: STACK_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'stack', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev:stack',
    cwd: '../..',
    url: `${STACK_URL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
