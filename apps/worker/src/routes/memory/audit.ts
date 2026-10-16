// GET /api/audit?limit=&cursor= — keyset paging (at DESC, id DESC); read-only (append-only table).
import { AuditQuerySchema, AuditResponseSchema, b64urlDecode, b64urlEncode } from '@aduin/core';
import type { Handler } from '../../app';
import { ProxyError } from '../../proxy/errors';
import { memoryCtx } from '../../memory/ctx';
import { handle, ok, parseWith, readGuards, type MemoryDeps } from '../../memory/http';
import { auditPage } from '../../memory/repo/audit';
import { ID_RE } from '../../db/ids';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeCursor(c: { at: number; id: string }): string {
  return b64urlEncode(enc.encode(`${c.at}.${c.id}`));
}

export function decodeCursor(s: string): { at: number; id: string } {
  const bytes = b64urlDecode(s);
  const m = bytes ? /^(\d{1,16})\.(.+)$/.exec(dec.decode(bytes)) : null;
  if (!m || !ID_RE.test(m[2]!)) throw new ProxyError('invalid_request', 'cursor');
  return { at: Number(m[1]), id: m[2]! };
}

export function auditHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'audit', async (request, env) => {
    readGuards(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: false });
    const sp = new URL(request.url).searchParams;
    const q = parseWith(AuditQuerySchema, {
      limit: sp.get('limit') ?? '50',
      ...(sp.get('cursor') ? { cursor: sp.get('cursor') } : {}),
    });
    const page = await auditPage(ctx, q.limit, q.cursor ? decodeCursor(q.cursor) : null);
    return ok(AuditResponseSchema, {
      events: page.events,
      ...(page.next ? { next_cursor: encodeCursor(page.next) } : {}),
    });
  });
}
