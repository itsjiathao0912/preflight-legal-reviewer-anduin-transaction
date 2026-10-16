import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Workers-runtime tests (Miniflare/workerd) via @cloudflare/vitest-plugin (successor of the
// deprecated @cloudflare/vitest-pool-workers). Bindings come from wrangler.jsonc.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: { include: ['test/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
});
