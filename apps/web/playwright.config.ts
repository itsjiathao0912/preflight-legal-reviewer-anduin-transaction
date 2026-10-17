import { defineConfig, devices } from '@playwright/test';

// Two projects:
//  preview = `vite preview` of a `--mode e2e` build (stub memory API, no Worker). Runs every Phase 03 spec.
//  stack   = built SPA + Worker /api/* served together by `wrangler dev` (pnpm dev:stack). Runs only
//            Phase 04a's slice.spec.ts.
// Playwright starts every configured webServer regardless of --project, so the stack server is only
// configured when the stack project is requested (`--project=stack` / `--project stack`).
const PREVIEW_PORT = 4317;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const LOCAL_STACK_URL = 'http://127.0.0.1:8787';
// SLICE_BASE_URL (https only) points the stack project at a deployed Worker; no local stack server then.
const SLICE_BASE_URL = process.env['SLICE_BASE_URL'];
if (
  SLICE_BASE_URL !== undefined &&
  !/^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$/.test(SLICE_BASE_URL)
)
  throw new Error('SLICE_BASE_URL must be an https://*.workers.dev origin');
const STACK_URL = SLICE_BASE_URL?.replace(/\/$/, '') ?? LOCAL_STACK_URL;

const argv = process.argv.join(' ');
// `(?![-\w])` so `--project=stack-memory` does not also start the Phase 04a stack server.
const wantsStack = /--project[= ]stack(?![-\w])/.test(argv);
const wantsStackMemory = /--project[= ]stack-memory(?![-\w])/.test(argv);

// stack-memory = built plain-mode SPA + Worker + seeded local D1 on :8788 (pnpm dev:stack:seeded:
// scripts/src/dev-seed.ts, random per-run cookie keys, recreated persist dir). Phase 08.
const STACK_MEMORY_PORT = 8788;
const STACK_MEMORY_URL = `http://127.0.0.1:${STACK_MEMORY_PORT}`;
const STACK_MEMORY_SPECS = /stack-memory-.*\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'preview',
      testIgnore: [/slice\.spec\.ts/, STACK_MEMORY_SPECS],
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
    {
      // Per-IP session cap is 5/day: specs give each browser context its own cf-connecting-ip
      // (see e2e/fixtures/stack-memory.ts). The server is never reused (fresh seeded D1 per run).
      name: 'stack-memory',
      testMatch: STACK_MEMORY_SPECS,
      use: { ...devices['Desktop Chrome'], baseURL: STACK_MEMORY_URL },
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
    ...(wantsStack && SLICE_BASE_URL === undefined
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
    // After the preview server: its plain-mode web build overwrites the e2e-mode bundle (E14).
    ...(wantsStackMemory
      ? [
          {
            command: 'pnpm dev:stack:seeded',
            cwd: '../..',
            url: `${STACK_MEMORY_URL}/api/health`,
            reuseExistingServer: false,
            timeout: 240_000,
          },
        ]
      : []),
  ],
});
