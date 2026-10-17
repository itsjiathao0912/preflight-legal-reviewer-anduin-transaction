import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Workers-runtime tests (Miniflare/workerd) via @cloudflare/vitest-plugin (successor of the
// deprecated @cloudflare/vitest-pool-workers). Bindings come from wrangler.jsonc.
// Phase 04b: the D1 migrations and the generated demo seed are passed in as bindings and applied
// by test/setup.ts (idempotent), so every test file sees the real schema on local D1 (SQLite).
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url).href);
const migrations = await readD1Migrations(here('./migrations'));
// Firm X/Y test seed (fixtures/memory/_test-seed-spec.json); the deployed seed/demo.sql (Partners
// Group, bundled samples) is exercised by the stack-memory e2e project instead.
const demoSeed = readFileSync(here('./seed/test-seed.sql'), 'utf8');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { TEST_MIGRATIONS: migrations, DEMO_SEED_SQL: demoSeed } },
    }),
  ],
  test: { include: ['test/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
});
