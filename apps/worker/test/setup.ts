// Net-connect disabled: any outbound request that is not routed through an injected stub
// (createApp(deps).fetch) throws, so an unmocked call fails the test. Never a live call.
import { applyD1Migrations, env } from 'cloudflare:test';

export const NET_GUARD_MESSAGE = 'net-connect disabled in tests: inject fetch via createApp(deps)';

globalThis.fetch = ((): never => {
  throw new Error(NET_GUARD_MESSAGE);
}) as unknown as typeof fetch;

// Phase 04b: apply migrations 0001-0004 and the generated demo seed once per database
// (both idempotent: d1_migrations tracks applied files; the seed is skipped when ws_demo exists).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
const seeded = await env.DB.prepare("SELECT 1 AS x FROM workspace WHERE id = 'ws_demo'").first();
if (!seeded) {
  const statements = env.DEMO_SEED_SQL.split('\n')
    .filter((l) => l.trim().length > 0 && !l.startsWith('--'))
    .map((l) => env.DB.prepare(l));
  await env.DB.batch(statements);
}
