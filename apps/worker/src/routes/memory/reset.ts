// POST /api/session/reset — "Start fresh" (19-10-26). Clears the analyst cookie `__Host-aduin_v`
// and the counsel cookie `__Host-aduin_c` with Max-Age=0 and the same attributes they were set
// with. Same header guards as every memory POST (client header, Origin, JSON, body cap); no cookie
// required, no D1 reads or writes. The old sandbox is left for the daily purge.
import { COUNSEL_COOKIE } from '../../memory/share';
import { VISITOR_COOKIE } from '../../limits/visitor';
import { handle, readJsonBody, type MemoryDeps } from '../../memory/http';
import { NO_STORE } from '../../proxy/errors';
import type { Handler } from '../../app';

const clear = (name: string): string =>
  `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

export function sessionResetHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'session_reset', async (request) => {
    await readJsonBody(request);
    const headers = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': NO_STORE,
    });
    headers.append('set-cookie', clear(VISITOR_COOKIE));
    headers.append('set-cookie', clear(COUNSEL_COOKIE));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  });
}
