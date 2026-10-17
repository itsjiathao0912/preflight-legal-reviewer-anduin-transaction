// Phase 05 test helpers (not a gate file: no `.test.ts` suffix). Workspace cookies, the forwarded
// prompt blocks, the recordings (JSON imported at transform time; never a network call) and a
// D1-backed harness over the real SQL ports. No secret of any kind is real.
import { env } from 'cloudflare:test';
import {
  LlmRecordingSchema,
  UNTRUSTED_DOCUMENT_TAG,
  UNTRUSTED_RULES_TAG,
  signCookie,
  type AiCandidate,
  type AiResponseMode,
  type AiTaskId,
  type LlmRecording,
  type QuotaKey,
  type SessionClaims,
} from '@aduin/core';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { capFor } from '../../src/limits/policy';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { createD1Platform, createRulesPort, withSessionCaps } from '../../src/platform/index';
import type { ProxyPlatform } from '../../src/proxy/ports';
import { COOKIE_KEY, T0, baseEnv, type Harness } from '../fakes/harness';
import { OpenRouterStub, type RecordedCall, type StubReply } from '../fakes/openrouter-stub';
import { TurnstileStub } from '../fakes/turnstile-stub';

/** Signed visitor cookie with a workspace claim (`w` requires an analyst `a`). */
export async function workspaceCookie(
  w: string | undefined,
  o: { v?: string; a?: string; nowMs?: number } = {},
): Promise<string> {
  const now = Math.floor((o.nowMs ?? T0) / 1000);
  const claims: SessionClaims = {
    v: o.v ?? `v${Math.random().toString(36).slice(2, 10)}`,
    ...(w !== undefined ? { w, a: o.a ?? 'an1' } : o.a !== undefined ? { a: o.a } : {}),
    iat: now,
    exp: now + 86_400,
    kid: 'k1',
  };
  return `${VISITOR_COOKIE}=${await signCookie(claims, COOKIE_KEY)}`;
}

export type Msg = { role: string; content: string };

export function messagesOf(call: RecordedCall): Msg[] {
  return call.json['messages'] as Msg[];
}

/** The user message content of a forwarded call. */
export function userContent(call: RecordedCall): string {
  const m = messagesOf(call).find((x) => x.role === 'user');
  if (!m) throw new Error('no user message');
  return m.content;
}

/** Parse the JSON inside `<tag>\n...\n</tag>` (escapes are valid JSON). */
export function tagJson(content: string, tag: string): unknown {
  const open = `<${tag}>\n`;
  const close = `\n</${tag}>`;
  const a = content.indexOf(open);
  const b = content.indexOf(close, a + open.length);
  if (a < 0 || b < 0) throw new Error(`tag ${tag} not found`);
  return JSON.parse(content.slice(a + open.length, b));
}

export const rulesIn = (call: RecordedCall): string[] =>
  tagJson(userContent(call), UNTRUSTED_RULES_TAG) as string[];

export const docIn = (call: RecordedCall): { id: string; text: string }[] =>
  tagJson(userContent(call), UNTRUSTED_DOCUMENT_TAG) as { id: string; text: string }[];

export function countOf(haystack: string, needle: string): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) n++;
  return n;
}

/** AI request body for the proxy. */
export function aiReq(
  candidates: AiCandidate[],
  law_firm_id: string | null,
  task: AiTaskId = 'clause-judgment',
) {
  return { v: 1, task, law_firm_id, candidates, settings: {} };
}

export function cand(quote: string, id = 'c1'): AiCandidate {
  return { id, quote, section_path: ['1'] };
}

// --- recordings (fixtures/llm-recordings/**, Stage 1c) ---

export interface RecordedRequestFile {
  task: AiTaskId;
  sample: string | null;
  candidates: AiCandidate[];
  rule_texts: string[];
  mode: AiResponseMode;
}

export interface RecordingFile {
  case: string;
  path: string;
  raw: Record<string, unknown>;
  rec: LlmRecording;
  request: RecordedRequestFile;
}

// AI task folders only: fixtures/llm-recordings/ocr/ holds OCR results (Phase 06), not AI recordings.
const files = import.meta.glob(
  '../../../../fixtures/llm-recordings/{clause-judgment,counsel-draft}/*.json',
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
);

export function loadRecordings(): RecordingFile[] {
  return Object.entries(files)
    .map(([path, text]) => {
      const raw = JSON.parse(String(text)) as Record<string, unknown>;
      return {
        case: String(raw['case']),
        path,
        raw,
        rec: LlmRecordingSchema.parse(raw),
        request: raw['request'] as RecordedRequestFile,
      };
    })
    .sort((a, b) => (a.case < b.case ? -1 : 1));
}

export function recordingByCase(id: string): RecordingFile {
  const r = loadRecordings().find((x) => x.case === id);
  if (!r) throw new Error(`recording ${id} not found`);
  return r;
}

/** OpenRouter completion that replays a recording's raw model content (free, cost 0). */
export function replay(r: RecordingFile): StubReply {
  return {
    status: 200,
    json: {
      model: r.rec.meta.served_model,
      choices: [{ message: { content: r.rec.response.raw }, finish_reason: 'stop' }],
      usage: { cost: 0 },
    },
  };
}

// --- D1-backed harness (real SQL quota/cache/ledger/rules ports on local D1) ---

export interface D1Harness extends Omit<Harness, 'platform' | 'timers'> {
  platform: ProxyPlatform;
  rulesCalls: { w: string; firm: string }[];
  /** make the next rules reads throw (simulated D1 failure) */
  rulesDown: boolean;
}

export function makeD1Harness(opts: { env?: Record<string, string> } = {}): D1Harness {
  const envVars = opts.env ?? baseEnv();
  const or = new OpenRouterStub();
  const ts = new TurnstileStub();
  or.other = ts.handle;
  const clock = { now: T0 };
  const logs: string[] = [];
  const cfg = loadConfig(envVars);
  const base = createD1Platform(env.DB, {
    capFor: withSessionCaps(capFor(cfg)) as (k: QuotaKey) => number,
    now: () => clock.now,
  });
  const h = {
    env: envVars,
    or,
    ts,
    logs,
    clock,
    waitUntilCalls: 0,
    rulesCalls: [] as { w: string; firm: string }[],
    rulesDown: false,
  } as unknown as D1Harness;
  h.platform = {
    ...base,
    rulesFor: (w) => {
      const port = createRulesPort(env.DB, w);
      return {
        activeRules: async (firm) => {
          h.rulesCalls.push({ w, firm });
          if (h.rulesDown) throw new Error('D1 read failed');
          return port.activeRules(firm);
        },
      };
    },
  };
  h.ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  h.app = createApp({
    fetch: or.fetch,
    now: () => clock.now,
    proxy: { platform: h.platform, log: (l) => logs.push(l) },
  });
  return h;
}

/** Insert a firm rule row directly (same columns as the 04b tests). */
export async function insertRule(
  ws: string,
  firm: string,
  status: 'active' | 'proposed' | 'rejected' | 'revoked',
  text: string,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, created_by_name, created_at, revoked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'T', 1, ?7)",
  )
    .bind(
      ws,
      `fr_${Math.random().toString(36).slice(2, 12)}`,
      firm,
      status === 'active' || status === 'revoked' ? 'manual' : 'proposed',
      status,
      text,
      status === 'revoked' ? 2 : null,
    )
    .run();
}
