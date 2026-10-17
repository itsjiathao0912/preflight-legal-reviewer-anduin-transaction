/**
 * record-ai: LIVE recording of LLM responses straight from OpenRouter (Phase 05, F2/F4).
 *
 * Guards (all enforced in code, G8):
 *   - refuses unless ALLOW_LIVE_LLM=1 AND a request cap is given (`--max-requests N` or env
 *     RECORD_MAX_REQUESTS); the cap can only LOWER the in-code ceiling of 8 requests;
 *   - model must be on the `:free` allow-list (never `openrouter/free`, never a paid id);
 *   - aborts at the first response with usage.cost > 0 (or a non-free served model);
 *   - every fetch counts toward the cap (no automatic retries);
 *   - the key is read from env only, sent only to the pinned openrouter.ai host, never printed,
 *     logged or stored; error bodies are redacted and truncated.
 *
 *   ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts record:ai --max-requests 4 --cases sample-01,sample-03
 *   pnpm --filter @aduin/scripts record:ai --dry-run            # plan only, no key, no network
 *
 * Options: --cases a,b (default: every case marked live), --mode json_schema|json_object,
 * --dry-run, --space-ms N (pause between calls, default 4000).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmRecordingSchema, TASKS, type AiResponseMode } from '@aduin/core';
import { TEXT_MODEL, parseContent, requestHash, upstreamBody } from './ai-request';
import { fileFor, serialize } from './author-recordings';
import { CASES, caseById, caseRequest, type RecordingCase } from './casebook';

/** Hard ceiling (APPROVED-LIVE 8). The CLI/env cap may only lower it. */
export const LIVE_REQUEST_CEILING = 8;
/** Free-only allow-list for live recording. */
export const FREE_MODEL_ALLOW_LIST: readonly string[] = Object.freeze([TEXT_MODEL]);
const PINNED_HOST = 'openrouter.ai';

export class RecordRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordRefusal';
  }
}

export interface RecordOptions {
  maxRequests: number;
  cases: RecordingCase[];
  mode: AiResponseMode;
  model: string;
  dryRun: boolean;
  spaceMs: number;
}

function flag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  return eq?.slice(name.length + 1);
}

/**
 * Served-model check (review L1): exact equality of the `:free`-stripped base ids. A prefix match
 * (`startsWith`) would accept e.g. a served `nvidia/nemotron` for `nvidia/nemotron-3-...:free`.
 */
export function sameBaseModel(requested: string, served: string): boolean {
  const base = (id: string) => (id.endsWith(':free') ? id.slice(0, -':free'.length) : id);
  return base(requested) === base(served);
}

export function isAllowedModel(id: string): boolean {
  return id.endsWith(':free') && id !== 'openrouter/free' && FREE_MODEL_ALLOW_LIST.includes(id);
}

/** Parse and enforce every guard that does not need the network. Throws RecordRefusal. */
export function resolveOptions(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): RecordOptions {
  const dryRun = argv.includes('--dry-run');
  const mode = (flag(argv, '--mode') ?? 'json_schema') as AiResponseMode;
  if (mode !== 'json_schema' && mode !== 'json_object')
    throw new RecordRefusal(`unknown --mode ${String(mode)}`);
  const model = flag(argv, '--model') ?? TEXT_MODEL;
  if (!isAllowedModel(model))
    throw new RecordRefusal(`model ${model} is not on the free allow-list`);
  const caseIds = flag(argv, '--cases');
  const cases = caseIds
    ? caseIds.split(',').map((s) => caseById(s.trim()))
    : CASES.filter((c) => c.live);
  const spaceMs = Number(flag(argv, '--space-ms') ?? 4000);
  const capRaw = flag(argv, '--max-requests') ?? env['RECORD_MAX_REQUESTS'];
  if (dryRun)
    return {
      maxRequests: 0,
      cases,
      mode,
      model,
      dryRun,
      spaceMs: Number.isFinite(spaceMs) ? spaceMs : 4000,
    };
  if (env['ALLOW_LIVE_LLM'] !== '1')
    throw new RecordRefusal('live recording refused: set ALLOW_LIVE_LLM=1');
  if (capRaw === undefined)
    throw new RecordRefusal(
      'live recording refused: --max-requests (or RECORD_MAX_REQUESTS) is required',
    );
  const cap = Number(capRaw);
  if (!Number.isInteger(cap) || cap < 1) throw new RecordRefusal(`invalid request cap ${capRaw}`);
  return {
    maxRequests: Math.min(cap, LIVE_REQUEST_CEILING),
    cases,
    mode,
    model,
    dryRun,
    spaceMs: Number.isFinite(spaceMs) && spaceMs >= 0 ? spaceMs : 4000,
  };
}

// Key prefix assembled at runtime so the source never holds the literal (secrets:scan).
const KEY_PREFIX_RE = new RegExp(['sk', 'or', ''].join('-') + '[A-Za-z0-9_-]+', 'g');

/** Redact anything key-like and truncate (error bodies may echo request data). */
export function redact(s: string, max = 200): string {
  return s
    .replace(KEY_PREFIX_RE, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, max);
}

export function baseUrlFrom(env: Record<string, string | undefined>): string {
  const raw = env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1';
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.hostname !== PINNED_HOST)
    throw new RecordRefusal('OPENROUTER_BASE_URL must be https://openrouter.ai/...');
  return raw.replace(/\/+$/, '');
}

interface Completion {
  model?: unknown;
  choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown };
}

export interface LiveOutcome {
  caseId: string;
  status: number;
  servedModel?: string;
  cost?: number;
  wrote?: string;
  note: string;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Run the live recording. Stops at the cap, at the first cost > 0 and at a non-free served model. */
export async function recordLive(
  opts: RecordOptions,
  env: Record<string, string | undefined>,
  fetchFn: FetchLike = (u, i) => fetch(u, i),
  log: (s: string) => void = (s) => console.log(s),
): Promise<{ requests: number; outcomes: LiveOutcome[]; aborted?: string }> {
  const key = env['OPENROUTER_API_KEY'];
  if (!key) throw new RecordRefusal('OPENROUTER_API_KEY is not set');
  const url = `${baseUrlFrom(env)}/chat/completions`;
  const outcomes: LiveOutcome[] = [];
  let requests = 0;
  for (const c of opts.cases) {
    if (requests >= opts.maxRequests) return { requests, outcomes, aborted: 'request cap reached' };
    if (requests > 0 && opts.spaceMs > 0) await new Promise((r) => setTimeout(r, opts.spaceMs));
    const req = caseRequest(c, opts.mode);
    const body = upstreamBody(req, opts.model);
    requests++;
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
          'x-title': 'aduin-transaction',
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      outcomes.push({
        caseId: c.id,
        status: 0,
        note: `network: ${redact(String((e as Error).name))}`,
      });
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      outcomes.push({ caseId: c.id, status: res.status, note: `upstream error: ${redact(text)}` });
      log(`${c.id}: HTTP ${res.status}`);
      continue;
    }
    let j: Completion;
    try {
      j = JSON.parse(text) as Completion;
    } catch {
      outcomes.push({ caseId: c.id, status: res.status, note: 'non-JSON completion' });
      continue;
    }
    const cost = typeof j.usage?.cost === 'number' ? j.usage.cost : 0;
    const served = typeof j.model === 'string' ? j.model : 'unknown';
    if (cost > 0) {
      outcomes.push({
        caseId: c.id,
        status: res.status,
        servedModel: served,
        cost,
        note: 'cost > 0, aborted, not written',
      });
      return { requests, outcomes, aborted: `usage.cost ${cost} > 0` };
    }
    if (served !== 'unknown' && !served.endsWith(':free') && !sameBaseModel(opts.model, served)) {
      outcomes.push({
        caseId: c.id,
        status: res.status,
        servedModel: served,
        cost,
        note: 'non-free served model, aborted',
      });
      return { requests, outcomes, aborted: `served model ${served} is not free` };
    }
    if (j.choices?.[0]?.finish_reason === 'length') {
      // truncated at max_tokens: never written as a recording (review L1)
      outcomes.push({
        caseId: c.id,
        status: res.status,
        servedModel: served,
        cost,
        note: 'finish_reason length (truncated), aborted, not written',
      });
      return { requests, outcomes, aborted: 'finish_reason length (truncated reply)' };
    }
    const raw = j.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || raw.length === 0) {
      outcomes.push({
        caseId: c.id,
        status: res.status,
        servedModel: served,
        cost,
        note: 'empty content',
      });
      continue;
    }
    const parsed = parseContent(raw);
    const hash = requestHash(req);
    const tin = Number(j.usage?.prompt_tokens);
    const tout = Number(j.usage?.completion_tokens);
    const rec = {
      case: c.id,
      taskId: c.task,
      promptVersion: TASKS[c.task].promptVersion,
      inputHash: hash,
      model: opts.model,
      messagesDigest: hash,
      request: req,
      response: { raw, parsed },
      meta: {
        source: 'live',
        served_model: served === 'unknown' ? opts.model : served,
        ...(Number.isInteger(tin) && Number.isInteger(tout)
          ? { tokens: { in: tin, out: tout } }
          : {}),
        recordedAt: new Date().toISOString(),
        cost_usd: cost,
        response_mode: opts.mode,
      },
    };
    LlmRecordingSchema.parse(rec);
    const v = TASKS[c.task].validate(parsed, { candidates: req.candidates });
    const path = fileFor(c, hash);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serialize(rec));
    const note = v.ok
      ? `valid: ${v.result.findings.length} findings, ${v.result.drafts?.length ?? 0} drafts, ${v.dropped} dropped`
      : 'model JSON malformed (recorded as is)';
    outcomes.push({
      caseId: c.id,
      status: res.status,
      servedModel: served,
      cost,
      wrote: path,
      note,
    });
    log(`${c.id}: ${note}`);
  }
  return { requests, outcomes };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const env = process.env as Record<string, string | undefined>;
  const opts = resolveOptions(argv, env);
  if (opts.dryRun) {
    for (const c of opts.cases) {
      const r = caseRequest(c, opts.mode);
      console.log(
        `${c.id}: task ${c.task}, ${r.candidates.length} candidates, inputHash ${requestHash(r).slice(0, 16)}, body ${upstreamBody(r, opts.model).length} bytes`,
      );
    }
    console.log('dry run: no request sent');
    return;
  }
  const out = await recordLive(opts, env);
  console.log(
    JSON.stringify(
      { requests: out.requests, aborted: out.aborted ?? null, outcomes: out.outcomes },
      null,
      2,
    ),
  );
  if (out.aborted && !out.aborted.startsWith('request cap')) process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(
      e instanceof RecordRefusal ? e.message : `record-ai failed: ${redact(String(e))}`,
    );
    process.exit(1);
  });
}
