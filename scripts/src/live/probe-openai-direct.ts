// `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts probe:openai-direct` — OpenAI provider plan
// stage-1 direct probe (step 5.3, operator-run, BILLED). Sends exactly the Worker's OpenAI request
// shape (same body builder, transformed strict schemas, OCR wire schema) straight to OpenAI, with
// `max_completion_tokens` lowered to 64, for: clause-judgment, counsel-draft and one OCR page
// (sample #9 page 1). Proves OpenAI accepts the request shapes before AI_PROVIDER is flipped.
//
// Guards (all before any network call):
//   - refuses unless ALLOW_LIVE_LLM=1 and OPENAI_API_KEY is set (the key is never printed);
//   - hard in-code ceiling of 3 calls per run;
//   - every call is claimed in the outside-repo live ledger (live/common.ts) BEFORE it is sent;
//   - the host is the pinned constant https://api.openai.com/v1 (no env override); fetch uses
//     redirect 'error';
//   - aborts on a served model that is not gpt-4.1-mini (bare or dated).
// Prints only: task, HTTP status, served model, usage tokens and computed µUSD.
// Exit: 0 all calls accepted (HTTP 200 with usage), 1 a call failed or a stop condition hit,
//       2 refused by a guard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { selectInjectedRules, TASKS, type AiCandidate, type AiTaskId } from '@aduin/core';
import {
  buildOpenAiBody,
  costMicroUsd,
  openAiOcrResponseFormat,
  openAiResponseFormat,
} from '../../../apps/worker/src/upstream/openai';
import { aiMessages, ocrMessages } from '../../../apps/worker/src/upstream/openrouter';
import { readSse } from '../../../apps/worker/src/upstream/sse';
import { downscaleJpeg, scanPages, SCAN_RAW_DIR } from '../samples/scan-set';
import { Ledger, LiveGuardError, log, OPENAI_SERVED_RE, type LedgerKind } from './common';

const P = 'probe:openai-direct';
/** Pinned host (same constant as the Worker; deliberately not configurable). */
export const PROBE_BASE = 'https://api.openai.com/v1';
export const PROBE_CEILING = 3;
export const PROBE_MAX_COMPLETION_TOKENS = 64;

export type ProbeStep = { task: AiTaskId; kind: 'ai' } | { task: 'ocr'; kind: 'ocr' };
export const PROBE_PLAN: readonly ProbeStep[] = Object.freeze([
  { task: 'clause-judgment', kind: 'ai' },
  { task: 'counsel-draft', kind: 'ai' },
  { task: 'ocr', kind: 'ocr' },
]);

const CANDIDATES: AiCandidate[] = [
  {
    id: 'c1',
    quote: 'Subject to Section 11, the Investor shall deliver the Form W-9 described in Annex F.',
    section_path: ['1'],
  },
];

export class ProbeRefusal extends Error {}

export interface ProbeLedger {
  claim(kind: LedgerKind, label: string): void;
}

export interface ProbeDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  ledger: () => ProbeLedger;
  /** one OCR page (JPEG base64) */
  ocrPage: () => string;
  print: (line: string) => void;
}

export interface ProbeCallResult {
  task: string;
  status: number;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costMicroUsd: number | null;
}

/** Request body for one step: the Worker's OpenAI body with max_completion_tokens lowered. */
export function probeBody(step: ProbeStep, ocrB64: () => string): string {
  const body =
    step.kind === 'ocr'
      ? buildOpenAiBody(
          'ocr',
          ocrMessages({ mime: 'image/jpeg', pages: [{ index: 0, data_b64: ocrB64() }] }),
          openAiOcrResponseFormat(),
        )
      : buildOpenAiBody(
          'ai',
          JSON.stringify(
            aiMessages(TASKS[step.task], CANDIDATES, selectInjectedRules([]), 'json_schema'),
          ),
          openAiResponseFormat(TASKS[step.task], 'json_schema'),
        );
  const at = body.indexOf('"max_completion_tokens":');
  const end = body.indexOf(',', at);
  return `${body.slice(0, at)}"max_completion_tokens":${PROBE_MAX_COMPLETION_TOKENS}${body.slice(end)}`;
}

function tok(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

/** Guards that need no network. Throws ProbeRefusal. */
export function assertProbeAllowed(env: Record<string, string | undefined>): string {
  if (env['ALLOW_LIVE_LLM'] !== '1')
    throw new ProbeRefusal('live call refused: set ALLOW_LIVE_LLM=1');
  const key = env['OPENAI_API_KEY']?.trim();
  if (!key) throw new ProbeRefusal('OPENAI_API_KEY is not set (load it outside the repo)');
  return key;
}

export async function runDirectProbe(
  deps: ProbeDeps,
): Promise<{ ok: boolean; results: ProbeCallResult[] }> {
  const key = assertProbeAllowed(deps.env);
  const ledger = deps.ledger();
  const results: ProbeCallResult[] = [];
  let sent = 0;
  for (const step of PROBE_PLAN) {
    if (sent >= PROBE_CEILING) throw new ProbeRefusal(`ceiling of ${PROBE_CEILING} calls reached`);
    const body = probeBody(step, deps.ocrPage);
    ledger.claim(step.kind, `${P} ${step.task}`); // claimed BEFORE the call leaves
    sent++;
    const res = await deps.fetch(`${PROBE_BASE}/chat/completions`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body,
    });
    const r: ProbeCallResult = {
      task: step.task,
      status: res.status,
      model: null,
      tokensIn: null,
      tokensOut: null,
      costMicroUsd: null,
    };
    if (res.ok && res.headers.get('content-type')?.startsWith('text/event-stream')) {
      const s = await readSse(res, {
        onActivity: () => {},
        maxContentChars: 2 * 1024 * 1024,
        maxRawBytes: 8 * 1024 * 1024,
      });
      if (s.ok) {
        r.model = s.model ?? null;
        const u = (s.usage ?? {}) as Record<string, unknown>;
        r.tokensIn = tok(u['prompt_tokens']);
        r.tokensOut = tok(u['completion_tokens']);
        if (r.tokensIn !== null && r.tokensOut !== null)
          r.costMicroUsd = costMicroUsd(r.tokensIn, r.tokensOut);
      }
    } else {
      await res.body?.cancel().catch(() => {});
    }
    results.push(r);
    deps.print(
      `${step.task} status=${r.status} model=${r.model ?? '(none)'} in=${r.tokensIn ?? '?'} ` +
        `out=${r.tokensOut ?? '?'} cost_micro_usd=${r.costMicroUsd ?? '?'}`,
    );
    if (r.model !== null && !OPENAI_SERVED_RE.test(r.model)) {
      deps.print(`STOP: served model ${r.model} is not gpt-4.1-mini`);
      return { ok: false, results };
    }
    if (r.status !== 200 || r.costMicroUsd === null) {
      deps.print('STOP: call not accepted (no usage); remaining calls skipped');
      return { ok: false, results };
    }
  }
  return { ok: true, results };
}

/** Sample #9 page 1, downscaled like the web render path. */
export function samplePageB64(): string {
  const first = scanPages()[0];
  if (!first) throw new ProbeRefusal('sample #9 scan pages not found');
  const raw = new Uint8Array(readFileSync(join(SCAN_RAW_DIR, first.raw)));
  return Buffer.from(downscaleJpeg(raw).jpeg).toString('base64');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const key = process.env['OPENAI_API_KEY'];
  runDirectProbe({
    env: process.env,
    fetch: (input, init) => fetch(input, init),
    ledger: () => new Ledger(),
    ocrPage: samplePageB64,
    print: (l) => log(P, l, key ? [key] : []),
  })
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e: unknown) => {
      const refused = e instanceof ProbeRefusal || e instanceof LiveGuardError;
      log(
        P,
        `${refused ? 'refused' : 'failed'}: ${e instanceof Error ? e.message : String(e)}`,
        key ? [key] : [],
      );
      process.exit(refused ? 2 : 1);
    });
}
