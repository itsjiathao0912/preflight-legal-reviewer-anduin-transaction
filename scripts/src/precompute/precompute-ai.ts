/**
 * precompute-ai: writes the static AI results the web app loads for bundled samples before it
 * would ever call /api/ai (Phase 05, F3; lookup order static -> D1 cache -> LLM).
 *
 * Output (COMMITTED, not generated at build; G6): apps/web/public/precomputed/{docHash}.{rulesHash8}.json
 * for the casebook cases marked `precompute` (samples #1 and #3). Bundled samples carry no firm
 * rules (no workspace cookie; the demo seed rule is only `proposed`), so rulesHash8 = 'none'.
 *
 *   pnpm --filter @aduin/scripts precompute:ai --from-recordings            # offline, deterministic bytes
 *   pnpm --filter @aduin/scripts precompute:ai --from-recordings --dry-run  # writes nothing
 *   pnpm --filter @aduin/scripts precompute:ai --from-recordings --check    # exit 1 if a file differs
 *
 * Without --from-recordings it records live first through record-ai (same guards: ALLOW_LIVE_LLM=1,
 * --max-requests, ceiling 8, free allow-list, abort at cost > 0), then builds from the recordings.
 * `public/precomputed/ocr` (Phase 06) is never touched.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AiResultSchema,
  LlmRecordingSchema,
  TASKS,
  rulesHash8,
  selectInjectedRules,
  type AiResult,
} from '@aduin/core';
import {
  PRECOMPUTED_DIR,
  RECORDINGS_DIR,
  requestHash,
  sampleCandidates,
} from '../record/ai-request';
import { fileFor, serialize } from '../record/author-recordings';
import { CASES, caseRequest, type RecordingCase } from '../record/casebook';
import { RecordRefusal, recordLive, resolveOptions } from '../record/record-ai';

export const PRECOMPUTED_KIND = 'aduin-precomputed-ai';

/** Shape of one precomputed file (the web lane re-verifies `result` in the engine worker on open). */
export interface PrecomputedAi {
  v: 1;
  kind: typeof PRECOMPUTED_KIND;
  docHash: string;
  sample: string;
  rulesHash8: string;
  task: string;
  promptVersion: string;
  schemaVersion: string;
  inputHash: string;
  model: string;
  served_model: string;
  source: 'authored' | 'live';
  result: AiResult;
}

export function precomputeCases(): RecordingCase[] {
  return CASES.filter((c) => c.precompute);
}

export function precomputedName(docHash: string, rh8: string): string {
  return `${docHash}.${rh8}.json`;
}

/** Build one precomputed object from the committed recording (offline). Throws on a miss. */
export function buildPrecomputed(
  c: RecordingCase,
  recordingsDir: string = RECORDINGS_DIR,
): PrecomputedAi {
  const req = caseRequest(c);
  const hash = requestHash(req);
  const path = fileFor(c, hash).replace(RECORDINGS_DIR, recordingsDir);
  if (!existsSync(path))
    throw new Error(`${c.id}: no recording for inputHash ${hash.slice(0, 16)}`);
  const rec = LlmRecordingSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  if (rec.inputHash !== hash) throw new Error(`${c.id}: recording inputHash mismatch`);
  const task = TASKS[c.task];
  const v = task.validate(rec.response.parsed, { candidates: req.candidates });
  if (!v.ok) throw new Error(`${c.id}: recorded model JSON is malformed`);
  const { docHash } = sampleCandidates(c.sample);
  const rules = selectInjectedRules(c.rule_texts);
  return {
    v: 1,
    kind: PRECOMPUTED_KIND,
    docHash,
    sample: c.sample,
    rulesHash8: rulesHash8(rules.hash),
    task: task.id,
    promptVersion: task.promptVersion,
    schemaVersion: task.schemaVersion,
    inputHash: hash,
    model: rec.model,
    served_model: rec.meta.served_model,
    source: rec.meta.source,
    result: AiResultSchema.parse(v.result),
  };
}

export interface PrecomputeReport {
  files: { path: string; bytes: string; changed: boolean }[];
}

export function precomputeFromRecordings(opts: {
  outDir?: string;
  recordingsDir?: string;
  write: boolean;
}): PrecomputeReport {
  const outDir = opts.outDir ?? PRECOMPUTED_DIR;
  const files: PrecomputeReport['files'] = [];
  for (const c of precomputeCases()) {
    const p = buildPrecomputed(c, opts.recordingsDir);
    const path = join(outDir, precomputedName(p.docHash, p.rulesHash8));
    const bytes = serialize(p);
    const changed = !existsSync(path) || readFileSync(path, 'utf8') !== bytes;
    files.push({ path, bytes, changed });
  }
  if (opts.write) {
    mkdirSync(outDir, { recursive: true });
    for (const f of files) if (f.changed) writeFileSync(f.path, f.bytes);
  }
  return { files };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const check = argv.includes('--check');
  if (!argv.includes('--from-recordings')) {
    const env = process.env as Record<string, string | undefined>;
    const ids = precomputeCases()
      .map((c) => c.id)
      .join(',');
    const opts = resolveOptions(['--cases', ids, ...argv], env);
    if (!opts.dryRun) {
      const out = await recordLive(opts, env);
      if (out.aborted && !out.aborted.startsWith('request cap'))
        throw new RecordRefusal(out.aborted);
    }
  }
  const rep = precomputeFromRecordings({ write: !dryRun && !check });
  for (const f of rep.files)
    console.log(
      `${dryRun || check ? (f.changed ? 'would write' : 'up to date') : f.changed ? 'wrote' : 'unchanged'} ${f.path}`,
    );
  if (check && rep.files.some((f) => f.changed)) {
    console.error('precomputed files are stale: run precompute:ai --from-recordings');
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
