/**
 * Shared request builder for the LLM recording and precompute scripts (Phase 05, Stage 1c).
 *
 * Single source of the request: messages come from core `TASKS[task].buildMessages`, the
 * `response_format` from core `responseFormat`, and the cache/recording key from core `inputHash`.
 * The upstream body template mirrors the Worker's `buildBody` (apps/worker/src/upstream/openrouter.ts):
 *   {"model":M,"models":[M],"messages":[...],"temperature":0,"max_tokens":AI_MAX_TOKENS,"response_format":{...}}
 * so a recorded request is byte-identical to what the Worker forwards (record-body-parity).
 *
 * Samples are untrusted input: read and parse only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AI_MAX_TOKENS,
  TASKS,
  analyzeHtml,
  buildAiCandidates,
  buildDriftNarrativeCandidates,
  diffDocuments,
  inputHash,
  responseFormat,
  runDeterministic,
  schemaInstruction,
  selectInjectedRules,
  type AiCandidate,
  type AiResponseMode,
  type AiTaskId,
  type LlmMessage,
} from '@aduin/core';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const RAW_SAMPLES = join(ROOT, 'samples', 'sub-docs', 'raw');
export const RECORDINGS_DIR = join(ROOT, 'fixtures', 'llm-recordings');
export const PRECOMPUTED_DIR = join(ROOT, 'apps', 'web', 'public', 'precomputed');

/** The only text model (free). Never `openrouter/free`, never a paid id. */
export const TEXT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
/** Single source in core (review L1), the same value as the Worker `MAX_TOKENS.ai`. */
export { AI_MAX_TOKENS };

/** Request description stored inside every recording (`request` key; extra to LlmRecordingSchema). */
export interface RecordedRequest {
  task: AiTaskId;
  /** Two-digit sample id the candidates were built from, or null for a synthetic request. */
  sample: string | null;
  candidates: AiCandidate[];
  rule_texts: string[];
  mode: AiResponseMode;
  /** Phase 07 drift-narrative: the [base, compare] sample pair the candidates were diffed from. */
  pair?: [string, string];
}

export function sampleFile(id: string): string {
  const f = readdirSync(RAW_SAMPLES).find((x) => x.startsWith(`${id}-`) && x.endsWith('.htm'));
  if (!f) throw new Error(`sample ${id} not found`);
  return join(RAW_SAMPLES, f);
}

/** docHash + graph-selected candidates for a bundled sample (same functions the engine worker uses). */
export function sampleCandidates(id: string): { docHash: string; candidates: AiCandidate[] } {
  const g = analyzeHtml(new Uint8Array(readFileSync(sampleFile(id))));
  return { docHash: g.doc.id, candidates: buildAiCandidates(g, runDeterministic(g)) };
}

/** Drift-narrative candidates for a sample pair (version diff, masked + clipped in core, E18). */
export function pairCandidates(a: string, b: string): AiCandidate[] {
  const side = (id: string) => {
    const g = analyzeHtml(new Uint8Array(readFileSync(sampleFile(id))));
    return { ok: true as const, structure: g.structure, graph: g, findings: runDeterministic(g) };
  };
  const o = diffDocuments({ a: side(a), b: side(b), mode: 'version' });
  if ('error' in o) throw new Error(`diff ${a}->${b} failed: ${o.error.code}`);
  return buildDriftNarrativeCandidates(o.result);
}

/**
 * Forwarded messages for a request: `TASKS[task].buildMessages(input, rules)`, plus the schema
 * instruction appended as a last system message in `json_object` mode.
 */
export function forwardedMessages(r: RecordedRequest): LlmMessage[] {
  const task = TASKS[r.task];
  const msgs = task.buildMessages({ candidates: r.candidates }, selectInjectedRules(r.rule_texts));
  return r.mode === 'json_object' ? [...msgs, schemaInstruction(task)] : msgs;
}

export function requestHash(r: RecordedRequest): string {
  return inputHash(forwardedMessages(r));
}

/**
 * Upstream chat-completions body, same template and key order as the Worker `buildBody`, MINUS
 * the Worker's trailing `"stream":true` (the recorder stays non-streaming; the prefix is
 * byte-identical, and `record-body-parity` pins the Worker body as this body plus that key).
 */
export function upstreamBody(r: RecordedRequest, model: string = TEXT_MODEL): string {
  const messages = JSON.stringify(
    forwardedMessages(r).map((m) => ({ role: m.role, content: m.content })),
  );
  return (
    `{"model":${JSON.stringify(model)},"models":${JSON.stringify([model])},"messages":${messages},` +
    `"temperature":0,"max_tokens":${AI_MAX_TOKENS},` +
    `"response_format":${JSON.stringify(responseFormat(TASKS[r.task], r.mode))}}`
  );
}

/** Same tolerant parse as the Worker `parseContent` (prose or a fenced block around one JSON object). */
export function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const a = fenced.indexOf('{');
    const b = fenced.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try {
      return JSON.parse(fenced.slice(a, b + 1));
    } catch {
      return null;
    }
  }
}
