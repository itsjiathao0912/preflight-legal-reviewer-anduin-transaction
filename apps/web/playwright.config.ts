import { defineConfig, devices } from '@playwright/test';

// Two projects:
//  preview = `vite preview` of a `--mode e2e` build (stub memory API, no Worker). Runs every Phase 03 spec.
//  stack   = built SPA + Worker /api/* served together by `wrangler dev` (pnpm dev:stack). Runs only
//            Phase 04a's slice.spec.ts.
// Playwright starts every configured webServer regardless of --project, so the stack server is only
// configured when the stack project is requested (`--project=stack` / `--project stack`).
const PREVIEW_PORT = 4317;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const STACK_URL = 'http://127.0.0.1:8787';

const argv = process.argv.join(' ');
const wantsStack = /--project[= ]stack\b/.test(argv);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'preview',
      testIgnore: /slice\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: PREVIEW_URL,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'stack',
      testMatch: /slice\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: STACK_URL },
    },
  ],
  webServer: [
    {
      command: `pnpm build:e2e && pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`,
      cwd: '.',
      url: PREVIEW_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    ...(wantsStack
      ? [
          {
            command: 'pnpm dev:stack',
            cwd: '../..',
            url: `${STACK_URL}/api/health`,
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]
      : []),
  ],
});
