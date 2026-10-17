// Memory route plumbing: guards (reused from the 04a proxy), body caps, zod parsing, error mapping.
// Responses are `no-store` with no CORS header; errors use the frozen `errorStatus`; bodies are
// never logged (the 04a redacting logger is used with event names and enums only).
import {
  ConflictBodySchema,
  errorBody,
  limits,
  type ActiveDecision,
  type TurnstilePort,
} from '@aduin/core';
import type { z } from 'zod';
import type { AppDeps, Env, Handler, RouteParams } from '../app';
import { createLogger, type Logger } from '../proxy/log';
import { errorResponse, jsonNoStore, messageFor, NO_STORE, ProxyError } from '../proxy/errors';
import {
  checkClientHeader,
  checkJsonContentType,
  checkOrigin,
  parseJsonObject,
  readBodyCapped,
} from '../proxy/guards';
import { classifyBatchError, TRIGGER_INVALID_REQUEST } from '../db/tx';
import { ID_RE } from '../db/ids';
import { resolveSession, verifySession, type MemoryCtx } from './ctx';

export const MEMORY_BODY_CAP = limits.otherBodyBytes; // 64 KB
export const FINDINGS_BODY_CAP = limits.aiBodyBytes; // 128 KB

export interface MemoryDeps {
  now: () => number;
  fetch: typeof fetch;
  turnstile?: TurnstilePort;
  logger: Logger;
}

export function memoryDeps(deps: AppDeps): MemoryDeps {
  const sink = deps.proxy?.log ?? ((line: string) => console.log(line));
  return {
    now: deps.now,
    fetch: deps.fetch,
    ...(deps.proxy?.turnstile ? { turnstile: deps.proxy.turnstile } : {}),
    logger: createLogger(sink, []),
  };
}

/** 409 conflict_active_decision with the current active decision (frozen ConflictBody). */
export class ConflictError extends Error {
  constructor(readonly current: ActiveDecision | null) {
    super('conflict_active_decision');
    this.name = 'ConflictError';
  }
}

export function conflictResponse(current: ActiveDecision | null): Response {
  const body = ConflictBodySchema.parse({
    ...errorBody({
      code: 'conflict_active_decision',
      message: messageFor('conflict_active_decision'),
    }),
    current,
  });
  return new Response(JSON.stringify(body), {
    status: 409,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE },
  });
}

export type MemoryHandler = (
  request: Request,
  env: Env,
  params: RouteParams,
  deps: MemoryDeps,
) => Promise<Response>;

/** Wrap a handler: typed errors map to frozen responses; anything else is memory_unavailable. */
export function handle(deps: MemoryDeps, name: string, fn: MemoryHandler): Handler {
  return async (request, env, _ctx, params) => {
    try {
      return await fn(request, env, params ?? {}, deps);
    } catch (e) {
      if (e instanceof ProxyError) return errorResponse(e);
      if (e instanceof ConflictError) return conflictResponse(e.current);
      const kind = classifyBatchError(e);
      if (kind.kind === 'trigger' && kind.trigger === 'demo_read_only')
        return errorResponse(new ProxyError('read_only_demo'));
      if (kind.kind === 'trigger' && TRIGGER_INVALID_REQUEST.has(kind.trigger))
        return errorResponse(new ProxyError('invalid_request', kind.trigger));
      deps.logger.log('memory.error', { route: name, kind: kind.kind });
      return errorResponse(new ProxyError('memory_unavailable', 'storage'));
    }
  };
}

/** Mutating call guards (header-only first), then the capped body read and JSON parse. */
export async function readJsonBody(
  request: Request,
  cap: number = MEMORY_BODY_CAP,
): Promise<Record<string, unknown>> {
  checkClientHeader(request);
  checkOrigin(request);
  checkJsonContentType(request);
  return parseJsonObject(await readBodyCapped(request, cap));
}

/**
 * Mutating/POST entry (review L5): header guards, then the cookie signature check (no DB), and
 * only then the capped body read + JSON parse, then liveness (+ the M1 write claim for writes).
 */
export async function postEntry(
  request: Request,
  env: { DB?: D1Database },
  now: number,
  opts: {
    write: boolean;
    cap?: number;
    /** Global write-row budget units (N1); a function sees the parsed body (findings: n + 5). */
    weight?: number | ((raw: Record<string, unknown>) => number);
  },
): Promise<{ ctx: MemoryCtx; raw: Record<string, unknown> }> {
  writeHeaderGuards(request);
  const s = await verifySession(request, env, now, { write: opts.write });
  const raw = parseJsonObject(await readBodyCapped(request, opts.cap ?? MEMORY_BODY_CAP));
  const w = typeof opts.weight === 'function' ? opts.weight(raw) : opts.weight;
  return { ctx: await resolveSession(s, w), raw };
}

/** Read guards (GET): client header only, no body. */
export function readGuards(request: Request): void {
  checkClientHeader(request);
}

export function writeHeaderGuards(request: Request): void {
  checkClientHeader(request);
  checkOrigin(request);
  checkJsonContentType(request);
}

/** Persisted client-chosen id fields checked against ID_RE after every schema parse. */
const SAFE_ID_KEYS = ['client_op_id', 'finding_ref'] as const;

export function parseWith<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ProxyError('invalid_request', 'schema');
  // Review L2: client-chosen ids that are persisted must use the safe Id charset.
  const d = r.data as unknown;
  if (d && typeof d === 'object')
    for (const k of SAFE_ID_KEYS) {
      const v = (d as Record<string, unknown>)[k];
      if (typeof v === 'string' && !ID_RE.test(v))
        throw new ProxyError('invalid_request', 'id_charset');
    }
  return r.data;
}

export function pathId(params: RouteParams, name = 'id'): string {
  const v = params[name];
  if (!v || !ID_RE.test(v)) throw new ProxyError('invalid_request', 'path_param');
  return v;
}

export function ok<T>(schema: z.ZodType<T>, body: T): Response {
  return jsonNoStore(schema.parse(body));
}
