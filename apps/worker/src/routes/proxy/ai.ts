import type { Handler } from '../../app';
import { handleProxy, type ProxyContext } from '../../proxy/pipeline';

/** POST /api/ai — contracts/ai.ts envelope in, NDJSON frames out. */
export function aiHandler(ctx: ProxyContext): Handler {
  return (request, env) => handleProxy('ai', request, env, ctx);
}
