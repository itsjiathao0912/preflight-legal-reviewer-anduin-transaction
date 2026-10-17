/**
 * One-off SSE shape probe (plan ai-review-stream-dedup_18-10-26, Section A). Not a package script.
 *
 *   set -a; source ~/.config/openrouter/credentials.env; set +a
 *   pnpm --filter @aduin/scripts exec tsx src/spikes/ai-stream-probe/probe.ts --probe p1a|p1b
 *
 * Hard stops: model is exactly the free text model; abort on usage.cost > 0 or a served model not
 * ending ':free'; at most 3 upstream calls total (own ledger outside the repo); per-call ceiling
 * 420 s. The key is read from the environment only and never printed (all output is redacted).
 */
import { join } from 'node:path';
import { TASKS, responseFormat } from '@aduin/core';
import { Ledger, assertOutsideRepo, defaultScratchDir, redact } from '../../live/common';
import { TEXT_MODEL, upstreamBody } from '../../record/ai-request';
import { caseById, caseRequest } from '../../record/casebook';
import { baseUrlFrom, sameBaseModel } from '../../record/record-ai';

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const CEILING_MS = 420_000;
const MAX_CALLS = 3;
/** Candidate prefilter (decision table row 3): lines worth JSON.parse. */
const PREFILTER = [/"content":"[^"]/, /"finish_reason":"/, /"usage"/, /"error"/];

if (TEXT_MODEL !== MODEL) throw new Error('TEXT_MODEL drifted from the approved free model');

type Probe = 'p1a' | 'p1b';

function probeArg(argv: readonly string[]): Probe {
  const i = argv.indexOf('--probe');
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (v !== 'p1a' && v !== 'p1b') throw new Error('usage: --probe p1a|p1b');
  return v;
}

function bodyFor(probe: Probe): string {
  if (probe === 'p1b') {
    const base = upstreamBody(caseRequest(caseById('sample-03')), MODEL);
    return `${base.slice(0, -1)},"stream":true}`;
  }
  const rf = responseFormat(TASKS['clause-judgment'], 'json_schema');
  return JSON.stringify({
    model: MODEL,
    models: [MODEL],
    messages: [
      {
        role: 'system',
        content: 'You review fund subscription clauses. Answer with JSON matching the schema.',
      },
      {
        role: 'user',
        content:
          'Candidate c1 (block b1): "The Investor shall return this form by the Closing Date." Report issues, or an empty findings list.',
      },
    ],
    temperature: 0,
    max_tokens: 400,
    response_format: rf,
    stream: true,
  });
}

interface Delta {
  content?: unknown;
  reasoning?: unknown;
  reasoning_details?: unknown;
  [k: string]: unknown;
}
interface Chunk {
  model?: unknown;
  error?: unknown;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown } | null;
  choices?: { delta?: Delta; finish_reason?: unknown }[];
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

async function main(): Promise<void> {
  const probe = probeArg(process.argv.slice(2));
  const key = process.env['OPENROUTER_API_KEY'];
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  const url = `${baseUrlFrom(process.env)}/chat/completions`;
  const say = (s: string) => console.log(redact(s, [key]));

  const ledger = new Ledger(assertOutsideRepo(join(defaultScratchDir(), 'ai-stream-probe')));
  if (ledger.counts('ai').phase >= MAX_CALLS) throw new Error('probe call cap (3) reached');
  ledger.claim('ai', `ai-stream-probe ${probe}`);

  const body = bodyFor(probe);
  const ac = new AbortController();
  const ceiling = setTimeout(() => ac.abort(), CEILING_MS);
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'x-title': 'aduin-transaction',
    },
    body,
    redirect: 'error',
    signal: ac.signal,
  });
  const tHeaders = performance.now() - t0;
  say(
    `${probe}: HTTP ${res.status} content-type=${res.headers.get('content-type')} headers_ms=${tHeaders.toFixed(0)}`,
  );
  if (!res.ok || !res.body) {
    say(`${probe}: error body: ${(await res.text()).slice(0, 600)}`);
    clearTimeout(ceiling);
    process.exitCode = 2;
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let bytes = 0;
  let last = t0;
  let firstByteMs: number | null = null;
  const gaps: number[] = [];
  const firstLines: string[] = [];
  const kinds = new Map<string, number>();
  const commentTimes: number[] = [];
  const models = new Set<string>();
  let content = '';
  let reasoningBytes = 0;
  let dataLines = 0;
  let reasoningOnly = 0;
  let finishReason: unknown = null;
  let finishLine = -1;
  let usage: Chunk['usage'] = null;
  let usageLine = -1;
  let doneLine = -1;
  let midError: unknown = null;
  let lineNo = 0;
  let prefilterFalseNeg = 0;
  let prefilterHits = 0;
  const deltaKeys = new Set<string>();
  let aborted: string | null = null;
  const bump = (k: string) => kinds.set(k, (kinds.get(k) ?? 0) + 1);

  const handle = (line: string, at: number) => {
    lineNo++;
    if (firstLines.length < 5) firstLines.push(line.slice(0, 220));
    if (line === '') return bump('blank');
    if (line.startsWith(':')) {
      commentTimes.push(at);
      return bump(`comment ${line.slice(0, 40)}`);
    }
    if (!line.startsWith('data:')) return bump('other');
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') {
      doneLine = lineNo;
      return bump('[DONE]');
    }
    dataLines++;
    const pre = PREFILTER.some((r) => r.test(payload));
    if (pre) prefilterHits++;
    const j = JSON.parse(payload) as Chunk;
    if (typeof j.model === 'string') models.add(j.model);
    if (j.error) midError = j.error;
    const ch = j.choices?.[0];
    const d = ch?.delta ?? {};
    for (const k of Object.keys(d)) deltaKeys.add(k);
    const c = typeof d.content === 'string' ? d.content : '';
    const r =
      (typeof d.reasoning === 'string' ? d.reasoning.length : 0) +
      (d.reasoning_details ? JSON.stringify(d.reasoning_details).length : 0);
    reasoningBytes += r;
    content += c;
    const fin = ch?.finish_reason ?? null;
    if (fin !== null && fin !== undefined) {
      finishReason = fin;
      finishLine = lineNo;
    }
    if (j.usage) {
      usage = j.usage;
      usageLine = lineNo;
    }
    const needed = c.length > 0 || (fin !== null && fin !== undefined) || !!j.usage || !!j.error;
    if (needed && !pre) prefilterFalseNeg++;
    if (r > 0 && c.length === 0 && !needed) reasoningOnly++;
    bump(
      c.length > 0
        ? 'data content'
        : r > 0
          ? 'data reasoning'
          : needed
            ? 'data finish/usage'
            : 'data empty',
    );
    const cost = j.usage?.cost;
    if (typeof cost === 'number' && cost > 0) {
      aborted = `usage.cost ${cost} > 0`;
      ac.abort();
    }
    if (
      typeof j.model === 'string' &&
      !j.model.endsWith(':free') &&
      !sameBaseModel(MODEL, j.model)
    ) {
      aborted = `served model ${j.model} not free`;
      ac.abort();
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const at = performance.now();
      if (firstByteMs === null) firstByteMs = at - t0;
      gaps.push(at - last);
      last = at;
      bytes += value.byteLength;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        handle(buf.slice(0, nl).replace(/\r$/, ''), at);
        buf = buf.slice(nl + 1);
      }
    }
    if (buf.length > 0) handle(buf, performance.now());
  } catch (e) {
    aborted ??= `stream error ${(e as Error).name}`;
  } finally {
    clearTimeout(ceiling);
  }

  const total = performance.now() - t0;
  const sorted = [...gaps].sort((a, b) => a - b);
  const commentGaps = commentTimes.slice(1).map((t, i) => t - (commentTimes[i] ?? t));
  let singleJson = false;
  try {
    const p = JSON.parse(content) as unknown;
    singleJson = typeof p === 'object' && p !== null && !Array.isArray(p);
  } catch {
    // not a single JSON value: singleJson stays false
  }
  const out = {
    probe,
    aborted,
    status: res.status,
    contentType: res.headers.get('content-type'),
    headersMs: Math.round(tHeaders),
    firstByteMs: firstByteMs === null ? null : Math.round(firstByteMs),
    totalMs: Math.round(total),
    bytes,
    reads: gaps.length,
    lines: lineNo,
    dataLines,
    reasoningOnlyLines: reasoningOnly,
    reasoningChars: reasoningBytes,
    contentChars: content.length,
    maxGapMs: Math.round(sorted[sorted.length - 1] ?? 0),
    p95GapMs: Math.round(pct(sorted, 95)),
    maxGapAfterFirstByteMs: Math.round(Math.max(0, ...gaps.slice(1))),
    kinds: Object.fromEntries(kinds),
    comments: commentTimes.length,
    commentCadenceMs: commentGaps.length
      ? Math.round(commentGaps.reduce((a, b) => a + b, 0) / commentGaps.length)
      : null,
    models: [...models],
    deltaKeys: [...deltaKeys],
    finishReason,
    finishLine,
    usageLine,
    doneLine,
    usage,
    midError: midError ? JSON.stringify(midError).slice(0, 300) : null,
    contentSingleJsonObject: singleJson,
    contentPrefix: content.slice(0, 160),
    prefilterHits,
    prefilterFalseNegatives: prefilterFalseNeg,
    firstLines,
  };
  say(JSON.stringify(out, null, 2));
  if (aborted) process.exitCode = 3;
}

main().catch((e: unknown) => {
  console.error(redact(`probe failed: ${(e as Error).message}`));
  process.exitCode = 1;
});
