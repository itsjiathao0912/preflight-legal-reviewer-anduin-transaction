/**
 * E2E build flag. True only in the Playwright `preview` build (`vite build --mode e2e`, which defines
 * VITE_E2E=1 in vite.config.ts). In every other build the define makes this `false` at compile time,
 * so every `if (IS_E2E) { ... }` block is removed by the minifier (proven by no-e2e-hook-in-dist).
 */
export const IS_E2E: boolean = import.meta.env.VITE_E2E === '1';
