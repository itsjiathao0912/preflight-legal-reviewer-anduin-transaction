// Types the `env` exported by cloudflare:test with this Worker's bindings.
declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB: D1Database;
    PAID_FALLBACK_ENABLED: string;
    /** Phase 04b: D1 migrations read by vitest.config.ts (readD1Migrations). */
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
    /** Phase 04b: generated seed/demo.sql (one statement per line). */
    DEMO_SEED_SQL: string;
  }
}

/** Vite `import.meta.glob` (used by the 04b statement-lint test with `?raw`). */
interface ImportMeta {
  glob(
    patterns: string | string[],
    options: { query: string; import: string; eager: true },
  ): Record<string, unknown>;
}

/** Vite `?raw` imports (text of a file at test-transform time). */
declare module '*?raw' {
  const text: string;
  export default text;
}
