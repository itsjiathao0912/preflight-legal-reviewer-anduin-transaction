/**
 * Must stay the first import in main.tsx (Phase 10 D2, CSP). Zod 4 probes `Function('')` once to
 * decide whether to JIT-compile parsers; under `script-src` without `unsafe-eval` that probe raises
 * a securitypolicyviolation. Zod reads `globalThis.__zod_globalConfig` when its core module loads,
 * so pre-seeding `jitless: true` here turns the probe off for every zod copy in the bundle.
 */
const g = globalThis as unknown as { __zod_globalConfig?: Record<string, unknown> };
g.__zod_globalConfig = { ...(g.__zod_globalConfig ?? {}), jitless: true };
export {};
