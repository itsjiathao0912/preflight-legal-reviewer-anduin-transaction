// S6 spike entry: the real route table + zod + @noble/hashes, so the measured bundle reflects
// the proxy/memory hot-path dependencies (not the empty skeleton).
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { createApp, json, type Env } from '../../../../apps/worker/src/app';

const Body = z.object({
  model: z.string().endsWith(':free'),
  messages: z.array(z.unknown()).max(50),
});

const app = createApp({ fetch: (i, init) => fetch(i, init), now: () => Date.now() });
app.route('POST', '/api/spike/validate', async (request) => {
  const text = await request.text();
  const parsed = Body.safeParse(JSON.parse(text));
  const digest = bytesToHex(sha256(new TextEncoder().encode(text)));
  return json({ ok: parsed.success, digest });
});

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
