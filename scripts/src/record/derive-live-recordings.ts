/**
 * derive-live-recordings: re-keys archived LIVE recordings onto the current engine candidate set
 * without a live call (ai-review-stream-dedup, C5). Offline, deterministic bytes, idempotent.
 *
 * For each archived live recording of an ENGINE-candidate case (`sample-01`, `sample-03`; not
 * fixed-candidate or pair cases) it rebuilds the current request (`caseRequest`) and keeps ONLY the
 * model's findings whose `candidate_id` still exists AND whose old candidate had the same `quote`
 * and `issue_class_hint` (so the model really saw this exact text). It never invents a finding and
 * never edits finding text. The output is labeled honestly:
 *   meta.source = 'authored' (it is not a raw live answer to this exact prompt),
 *   meta.recordedAt = the legacy recording time,
 *   request.derived_from = { inputHash16, source: 'live', kept, dropped }.
 * `record:author` keeps files that carry `request.derived_from`.
 *
 *   pnpm --filter @aduin/scripts record:derive --from <dir-of-archived-live-recordings>
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmRecordingSchema, TASKS, type AiCandidate } from '@aduin/core';
import {
  RECORDINGS_DIR,
  ROOT,
  parseContent,
  requestHash,
  type RecordedRequest,
} from './ai-request';
import { fileFor, serialize } from './author-recordings';
import { CASES, caseRequest, type RecordingCase } from './casebook';

type Json = Record<string, unknown>;

/** Default archive written by the ai-review-stream-dedup task (C2). */
export const DEFAULT_ARCHIVE = join(
  ROOT,
  'process/general-plans/active/ai-review-stream-dedup_18-10-26/legacy-live-recordings',
);

export interface DerivedFrom {
  inputHash16: string;
  source: 'live';
  kept: number;
  dropped: number;
}

/** True when a case's candidates come from `buildAiCandidates` for one sample (derivable). */
export function isEngineCase(c: RecordingCase): boolean {
  return c.task === 'clause-judgment' && !c.pair && !c.fixedCandidates && c.pick === 'all';
}

/**
 * Pure derive: legacy live recording + the current request -> derived recording object.
 * Throws on a non-live input or a legacy file without parsed findings.
 */
export function deriveRecording(legacy: Json, req: RecordedRequest, hash: string): Json {
  const meta = legacy['meta'] as Json | undefined;
  if (meta?.['source'] !== 'live')
    throw new Error(`${String(legacy['case'])}: not a live recording`);
  const oldReq = legacy['request'] as { candidates: AiCandidate[] } | undefined;
  const parsed = (legacy['response'] as Json | undefined)?.['parsed'] as Json | undefined;
  const findings = parsed?.['findings'];
  if (!oldReq || !Array.isArray(findings))
    throw new Error(`${String(legacy['case'])}: legacy recording has no request or findings`);
  const oldById = new Map(oldReq.candidates.map((c) => [c.id, c]));
  const newById = new Map(req.candidates.map((c) => [c.id, c]));
  const kept = (findings as Json[]).filter((f) => {
    const id = typeof f['candidate_id'] === 'string' ? f['candidate_id'] : '';
    const o = oldById.get(id);
    const n = newById.get(id);
    return (
      o !== undefined &&
      n !== undefined &&
      o.quote === n.quote &&
      o.issue_class_hint === n.issue_class_hint
    );
  });
  const raw = JSON.stringify({ findings: kept });
  const derived_from: DerivedFrom = {
    inputHash16: String(legacy['inputHash']).slice(0, 16),
    source: 'live',
    kept: kept.length,
    dropped: findings.length - kept.length,
  };
  const rec = {
    case: legacy['case'],
    taskId: req.task,
    promptVersion: TASKS[req.task].promptVersion,
    inputHash: hash,
    model: legacy['model'],
    messagesDigest: hash,
    request: { ...req, derived_from },
    response: { raw, parsed: parseContent(raw) },
    meta: {
      source: 'authored',
      served_model: meta['served_model'],
      recordedAt: meta['recordedAt'],
    },
  };
  LlmRecordingSchema.parse(rec);
  return rec;
}

export interface DeriveReport {
  written: string[];
  unchanged: string[];
  skipped: string[];
}

/** Derive every archived live recording of an engine case into `dir` (default: the fixtures). */
export function deriveAll(opts: {
  from: string;
  dir?: string;
  cases?: readonly RecordingCase[];
}): DeriveReport {
  const dir = opts.dir ?? RECORDINGS_DIR;
  const cases = opts.cases ?? CASES;
  const rep: DeriveReport = { written: [], unchanged: [], skipped: [] };
  if (!existsSync(opts.from)) throw new Error(`archive not found: ${opts.from}`);
  for (const f of readdirSync(opts.from)
    .filter((x) => x.endsWith('.json'))
    .sort()) {
    const legacy = JSON.parse(readFileSync(join(opts.from, f), 'utf8')) as Json;
    const c = cases.find((x) => x.id === legacy['case']);
    if (!c || !isEngineCase(c)) {
      rep.skipped.push(f);
      continue;
    }
    const req = caseRequest(c);
    const hash = requestHash(req);
    const path = fileFor(c, hash).replace(RECORDINGS_DIR, dir);
    const bytes = serialize(deriveRecording(legacy, req, hash));
    if (existsSync(path) && readFileSync(path, 'utf8') === bytes) {
      rep.unchanged.push(path);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    rep.written.push(path);
  }
  return rep;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--from');
  const from = i > 0 && process.argv[i + 1] ? resolve(process.argv[i + 1]!) : DEFAULT_ARCHIVE;
  const rep = deriveAll({ from });
  for (const p of rep.written) console.log(`derived ${p}`);
  for (const p of rep.unchanged) console.log(`unchanged ${p}`);
  for (const p of rep.skipped) console.log(`skipped (not an engine-candidate case) ${p}`);
}
