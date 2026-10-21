// `pnpm --filter @aduin/scripts bench:defects --offline --subset verified` — defect bench over the
// EDGAR sub-doc corpus (llm-defect-detection). For each document: the deterministic engine, the
// reference-target pair builder and the reference-target task (recorded transport by default),
// matched against `fixtures/defect-bench/ground-truth.json`.
//
// Modes:
//   --offline (default)  replay recordings from fixtures/defect-bench/recordings/ (`--source
//                        authored|live`, default authored). Missing = "not recorded", never a false
//                        positive; a recording for the doc whose input hash no longer matches = stale.
//   --live               BILLED. Refuses unless ALLOW_LIVE_LLM=1 and OPENAI_API_KEY is set (never
//                        printed). Every call is claimed in the BenchLedger (outside the repo, USD)
//                        BEFORE it is sent; per-run call ceiling (default 20, --max-calls may only
//                        lower it), per-run budget --max-usd (default 1.00; passing it exits non-zero
//                        asking the user), lifetime stop at $10. Pinned host api.openai.com, no retry.
//                        Responses are saved as meta.source 'live' recordings.
//   --subset verified|heldout|all  verified = the 16 hand-checked docs (default); heldout = the other
//                        corpus docs (precision only: every finding there is non-matching; no recall
//                        gate; a --max-calls above 20 is allowed, as for all).
//   --check-ground-truth assert every anchor exists in its document (corpus present).
//   --fetch              download missing corpus docs from sources.json (public SEC data, no LLM;
//                        User-Agent from env BENCH_USER_AGENT, refused when unset).
// Exit: 0 pass, 1 gate failed / missing corpus / stop condition, 2 refused by a guard.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  analyzeHtml,
  buildReferencePairs,
  inputHash,
  LlmRecordingSchema,
  normalizeForLocate,
  runDeterministic,
  selectInjectedRules,
  TASKS,
  verifyAiResult,
  type AiCandidate,
  type AiCandidateSite,
  type DocGraph,
  type Finding,
  type LlmMessage,
} from '@aduin/core';
import { z } from 'zod';
import {
  buildOpenAiBody,
  costMicroUsd,
  openAiResponseFormat,
  worstCaseMicroUsd,
} from '../../../apps/worker/src/upstream/openai';
import { aiMessages } from '../../../apps/worker/src/upstream/openrouter';
import { readSse } from '../../../apps/worker/src/upstream/sse';
import { OPENAI_SERVED_RE, ROOT, redact } from '../live/common';
import {
  BenchLedger,
  BenchRefusal,
  benchLimits,
  fileStore,
  type BenchLedgerStore,
} from './bench-ledger';

const P = 'bench:defects';
/** Pinned host (deliberately not configurable). */
export const BENCH_BASE = 'https://api.openai.com/v1';
export const BENCH_DIR = join(ROOT, 'fixtures', 'defect-bench');
export const RECORDINGS_DIR = join(BENCH_DIR, 'recordings');
export const CORPUS_DIR = join(BENCH_DIR, 'corpus');
export const SAMPLES_DIR = join(ROOT, 'samples', 'sub-docs', 'raw');
const TASK = TASKS['reference-target'];

// ---------------------------------------------------------------------------------------------
// Ground truth

const DefectSchema = z.object({
  id: z.string(),
  kind: z.string(),
  expect: z.enum(['reference-target', 'engine', 'none']),
  anchors: z.array(z.string().min(4)).min(1),
  why: z.string(),
});
const GroundTruthSchema = z.object({
  v: z.literal(1),
  docs: z.array(
    z.object({
      file: z.string(),
      origin: z.enum(['samples', 'corpus']),
      url: z.string().url(),
      verified: z.boolean(),
      defects: z.array(DefectSchema),
    }),
  ),
});
export type GroundTruth = z.infer<typeof GroundTruthSchema>;
export type GtDoc = GroundTruth['docs'][number];

export function loadGroundTruth(file = join(BENCH_DIR, 'ground-truth.json')): GroundTruth {
  return GroundTruthSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

/** Normalized, whitespace-free form used for anchor matching. */
export const squash = (s: string): string => normalizeForLocate(s).text.replace(/ /g, '');

/** A finding counts as caught when its document sentence contains the anchor. */
export function sentenceHasAnchor(sentence: string, anchor: string): boolean {
  const a = squash(anchor);
  return a.length > 0 && squash(sentence).includes(a);
}

// ---------------------------------------------------------------------------------------------
// Recordings (keyed by input hash; the hash covers every pair plus the playbook)

export const BenchRecordingSchema = LlmRecordingSchema.extend({ doc: z.string().min(1) });
export type BenchRecording = z.infer<typeof BenchRecordingSchema>;

export function recordingFile(hash: string, source: 'authored' | 'live'): string {
  return `${hash.slice(0, 16)}${source === 'live' ? '.live' : ''}.json`;
}

export interface RecordingStore {
  list(): BenchRecording[];
  write(name: string, r: BenchRecording): void;
}

export function dirRecordingStore(dir = RECORDINGS_DIR): RecordingStore {
  return {
    list() {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => BenchRecordingSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
    },
    write(name, r) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), JSON.stringify(r, null, 2) + '\n');
    },
  };
}

export type ReplayLookup =
  { kind: 'hit'; rec: BenchRecording } | { kind: 'stale' } | { kind: 'not_recorded' };

export function lookupRecording(
  recs: readonly BenchRecording[],
  doc: string,
  hash: string,
  source: 'authored' | 'live',
): ReplayLookup {
  const mine = recs.filter((r) => r.doc === doc && r.meta.source === source);
  const hit = mine.find((r) => r.inputHash === hash);
  if (hit) return { kind: 'hit', rec: hit };
  return mine.length > 0 ? { kind: 'stale' } : { kind: 'not_recorded' };
}

// ---------------------------------------------------------------------------------------------
// Per-document analysis

export interface DocAnalysis {
  g: DocGraph;
  findings: Finding[];
  pairs: AiCandidate[];
  sites: AiCandidateSite[];
  messages: LlmMessage[];
  hash: string;
}

export function analyzeDoc(bytes: Uint8Array): DocAnalysis {
  const g = analyzeHtml(bytes);
  const findings = runDeterministic(g);
  const { candidates, sites } = buildReferencePairs(g, findings);
  const messages = aiMessages(TASK, candidates, selectInjectedRules([]), 'json_schema');
  return { g, findings, pairs: candidates, sites, messages, hash: inputHash(messages) };
}

/** Verify a model answer exactly as the web engine worker does (pointer-site scoped). */
export function verifyAnswer(a: DocAnalysis, parsed: unknown, model: string): Finding[] {
  const v = TASK.validate(parsed, { candidates: a.pairs });
  if (!v.ok) return [];
  const out = verifyAiResult(a.g, v.result, {
    model,
    provenance: 'fresh',
    task: 'reference-target',
    sites: a.sites,
    ruleFindings: a.findings,
  });
  return out.ok ? out.findings : [];
}

// ---------------------------------------------------------------------------------------------
// Scoring

export interface DocScore {
  file: string;
  pairs: number;
  replay: 'hit' | 'stale' | 'not_recorded' | 'no_pairs' | 'live' | 'live_failed';
  rtFindings: number;
  caught: string[];
  missed: string[];
  falsePositives: number;
  engineCaught: string[];
  engineMissed: string[];
  engineNonMatches: number;
  tokensIn: number;
  tokensOut: number;
  costMicroUsd: number;
}

export function scoreDoc(
  d: GtDoc,
  a: DocAnalysis,
  rt: readonly Finding[],
): Omit<DocScore, 'replay' | 'tokensIn' | 'tokensOut' | 'costMicroUsd'> {
  const anchors = d.defects.flatMap((x) => x.anchors);
  const caughtBy = (fs: readonly Finding[], x: GtDoc['defects'][number]) =>
    fs.some((f) => x.anchors.some((an) => sentenceHasAnchor(f.quote, an)));
  const rule = a.findings.filter((f) => f.detector_kind === 'rule');
  const rtWanted = d.defects.filter((x) => x.expect === 'reference-target');
  const engWanted = d.defects.filter((x) => x.expect === 'engine');
  return {
    file: d.file,
    pairs: a.pairs.length,
    rtFindings: rt.length,
    caught: rtWanted.filter((x) => caughtBy(rt, x)).map((x) => x.id),
    missed: rtWanted.filter((x) => !caughtBy(rt, x)).map((x) => x.id),
    falsePositives: rt.filter((f) => !anchors.some((an) => sentenceHasAnchor(f.quote, an))).length,
    engineCaught: engWanted.filter((x) => caughtBy(rule, x)).map((x) => x.id),
    engineMissed: engWanted.filter((x) => !caughtBy(rule, x)).map((x) => x.id),
    engineNonMatches: rule.filter((f) => !anchors.some((an) => sentenceHasAnchor(f.quote, an)))
      .length,
  };
}

// ---------------------------------------------------------------------------------------------
// Live call

export interface LiveResult {
  status: number;
  model: string | null;
  content: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

function tok(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

export async function liveCall(
  fetchFn: typeof fetch,
  key: string,
  messages: LlmMessage[],
): Promise<LiveResult> {
  const body = buildOpenAiBody(
    'ai',
    JSON.stringify(messages),
    openAiResponseFormat(TASK, 'json_schema'),
  );
  const res = await fetchFn(`${BENCH_BASE}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body,
  });
  const r: LiveResult = {
    status: res.status,
    model: null,
    content: null,
    tokensIn: null,
    tokensOut: null,
  };
  if (res.ok && res.headers.get('content-type')?.startsWith('text/event-stream')) {
    const s = await readSse(res, {
      onActivity: () => {},
      maxContentChars: 2 * 1024 * 1024,
      maxRawBytes: 8 * 1024 * 1024,
    });
    if (s.ok) {
      r.model = s.model ?? null;
      r.content = s.content;
      const u = (s.usage ?? {}) as Record<string, unknown>;
      r.tokensIn = tok(u['prompt_tokens']);
      r.tokensOut = tok(u['completion_tokens']);
    }
  } else {
    await res.body?.cancel().catch(() => {});
  }
  return r;
}

/** Worst-case µUSD of one bench call (same formula as the Worker spend cap). */
export function worstCaseFor(messages: LlmMessage[]): number {
  return worstCaseMicroUsd(
    'ai',
    JSON.stringify(messages),
    openAiResponseFormat(TASK, 'json_schema'),
  );
}

// ---------------------------------------------------------------------------------------------
// Runner

export interface BenchOptions {
  mode: 'offline' | 'live';
  /** heldout = corpus docs NOT in the verified subset (precision check; no recall gate) */
  subset: 'verified' | 'heldout' | 'all';
  source: 'authored' | 'live';
  checkGroundTruth: boolean;
  maxCalls?: string;
  maxUsd?: string;
  corpus?: string;
}

export interface BenchDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  ledgerStore: () => BenchLedgerStore;
  recordings: RecordingStore;
  /** document bytes; null when the corpus file is missing */
  readDoc: (d: GtDoc, corpusDir: string) => Uint8Array | null;
  print: (line: string) => void;
  gt: GroundTruth;
  clock?: () => Date;
}

export function inSubset(d: GtDoc, subset: BenchOptions['subset']): boolean {
  return subset === 'all' || (subset === 'verified' ? d.verified : !d.verified);
}

export function defaultReadDoc(d: GtDoc, corpusDir: string): Uint8Array | null {
  const f = join(d.origin === 'samples' ? SAMPLES_DIR : corpusDir, d.file);
  return existsSync(f) ? new Uint8Array(readFileSync(f)) : null;
}

/** Guards that need no network. Throws BenchRefusal. */
export function assertLiveAllowed(env: Record<string, string | undefined>): string {
  if (env['ALLOW_LIVE_LLM'] !== '1')
    throw new BenchRefusal('live call refused: set ALLOW_LIVE_LLM=1');
  const key = env['OPENAI_API_KEY']?.trim();
  if (!key) throw new BenchRefusal('OPENAI_API_KEY is not set (load it outside the repo)');
  return key;
}

export interface BenchOutcome {
  ok: boolean;
  scores: DocScore[];
  reasons: string[];
  spentMicroUsd: number;
}

export async function runBench(opts: BenchOptions, deps: BenchDeps): Promise<BenchOutcome> {
  const live = opts.mode === 'live';
  const key = live ? assertLiveAllowed(deps.env) : '';
  const ledger = live
    ? new BenchLedger(
        deps.ledgerStore(),
        benchLimits(opts.maxCalls, opts.maxUsd, opts.subset !== 'verified'),
        deps.clock,
      )
    : null;
  const print = (l: string) => deps.print(redact(l, key ? [key] : []));
  const corpusDir = opts.corpus ?? CORPUS_DIR;
  const docs = deps.gt.docs.filter((d) => inSubset(d, opts.subset));
  const missing = docs.filter((d) => deps.readDoc(d, corpusDir) === null).map((d) => d.file);
  if (missing.length > 0)
    return {
      ok: false,
      scores: [],
      reasons: [
        `corpus not found: seed fixtures/defect-bench/corpus or pass --corpus <dir> or --fetch ` +
          `(${missing.length} missing, e.g. ${missing[0]})`,
      ],
      spentMicroUsd: 0,
    };
  const recs = deps.recordings.list();
  const scores: DocScore[] = [];
  const reasons: string[] = [];
  for (const d of docs) {
    const bytes = deps.readDoc(d, corpusDir)!;
    const a = analyzeDoc(bytes);
    if (opts.checkGroundTruth) {
      const text = a.g.structure.blocks.map((b) => b.lines.map((l) => l.text).join(' ')).join(' ');
      for (const x of d.defects)
        for (const an of x.anchors)
          if (!squash(text).includes(squash(an)))
            reasons.push(`anchor not in doc: ${x.id} ${d.file}`);
    }
    let rt: Finding[] = [];
    let replay: DocScore['replay'] = 'no_pairs';
    let tIn = 0;
    let tOut = 0;
    let cost = 0;
    if (a.pairs.length > 0 && !live) {
      const l = lookupRecording(recs, d.file, a.hash, opts.source);
      replay = l.kind;
      if (l.kind === 'hit') {
        rt = verifyAnswer(a, l.rec.response.parsed, l.rec.model);
        tIn = l.rec.meta.tokens?.in ?? 0;
        tOut = l.rec.meta.tokens?.out ?? 0;
        cost = tIn || tOut ? costMicroUsd(tIn, tOut) : 0;
      }
    } else if (a.pairs.length > 0 && ledger) {
      const handle = ledger.claim(`${P} reference-target`, d.file, worstCaseFor(a.messages));
      const r = await liveCall(deps.fetch, key, a.messages);
      replay = 'live_failed';
      if (r.tokensIn !== null && r.tokensOut !== null) {
        tIn = r.tokensIn;
        tOut = r.tokensOut;
        cost = costMicroUsd(tIn, tOut);
        ledger.settle(handle, cost, tIn, tOut);
      }
      if (r.model !== null && !OPENAI_SERVED_RE.test(r.model)) {
        reasons.push(`STOP: served model ${r.model} is not gpt-4.1-mini`);
        print(`STOP: served model ${r.model} is not gpt-4.1-mini`);
        break;
      }
      if (r.status !== 200 || r.content === null) {
        reasons.push(`STOP: ${d.file} call not accepted (status ${r.status}); no retry`);
        print(`STOP: ${d.file} call not accepted (status ${r.status}); remaining calls skipped`);
        break;
      }
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(r.content);
      } catch {
        parsed = null;
      }
      replay = 'live';
      rt = verifyAnswer(a, parsed, r.model ?? 'unknown');
      deps.recordings.write(recordingFile(a.hash, 'live'), {
        doc: d.file,
        taskId: 'reference-target',
        promptVersion: TASK.promptVersion,
        inputHash: a.hash,
        model: r.model ?? 'unknown',
        messagesDigest: a.hash,
        response: { raw: r.content, parsed },
        meta: {
          source: 'live',
          served_model: r.model ?? 'unknown',
          tokens: { in: tIn, out: tOut },
          recordedAt: (deps.clock?.() ?? new Date()).toISOString().slice(0, 10),
        },
      });
    }
    scores.push({
      ...scoreDoc(d, a, rt),
      replay,
      tokensIn: tIn,
      tokensOut: tOut,
      costMicroUsd: cost,
    });
  }
  printTable(scores, print);
  // Gates
  const all = (k: 'caught' | 'missed' | 'engineCaught' | 'engineMissed') =>
    scores.flatMap((s) => s[k]);
  const fp = scores.reduce((n, s) => n + s.falsePositives, 0);
  const rtTotal = deps.gt.docs
    .filter((d) => inSubset(d, opts.subset))
    .flatMap((d) => d.defects.filter((x) => x.expect === 'reference-target'));
  for (const s of scores)
    if (s.replay === 'stale') reasons.push(`stale recording for ${s.file} (re-run bench:author)`);
  if (all('engineMissed').length > 0)
    reasons.push(`engine missed: ${all('engineMissed').join(', ')}`);
  // AC10 thresholds apply to a live run AND to an offline replay of live recordings (model
  // answers); the strict authored gate (3 of 3, 0 non-matching) applies to authored replays only
  if (live || opts.source === 'live') {
    if (opts.subset !== 'heldout' && all('caught').length < 2)
      reasons.push(`live recall ${all('caught').length} of ${rtTotal.length} < 2`);
    for (const s of scores)
      if (s.falsePositives > 2)
        reasons.push(`${s.file}: ${s.falsePositives} non-matching findings > 2`);
    if (fp > 16) reasons.push(`${fp} non-matching findings in total > 16`);
  } else {
    if (all('missed').length > 0)
      reasons.push(`reference-target missed: ${all('missed').join(', ')}`);
    if (fp > 0) reasons.push(`${fp} reference-target false positives`);
  }
  const spent = ledger?.runSpentMicroUsd() ?? 0;
  print(
    `summary: reference-target caught ${all('caught').length}/${rtTotal.length} ` +
      `(${all('caught').join(', ') || '-'}), missed ${all('missed').join(', ') || '-'}, ` +
      `non-matching ${fp}; engine caught ${all('engineCaught').length}/${all('engineCaught').length + all('engineMissed').length}` +
      (live
        ? `; spend $${(spent / 1e6).toFixed(4)} this run, lifetime $${((ledger?.lifetimeMicroUsd() ?? 0) / 1e6).toFixed(4)}`
        : ''),
  );
  for (const r of reasons) print(`FAIL ${r}`);
  return { ok: reasons.length === 0, scores, reasons, spentMicroUsd: spent };
}

function printTable(scores: readonly DocScore[], print: (l: string) => void): void {
  print(
    'doc'.padEnd(44) +
      ' pairs replay        rt  caught        missed  fp  engine(caught/missed/nonmatch)  tok_in tok_out  usd',
  );
  for (const s of scores)
    print(
      s.file.slice(0, 43).padEnd(44) +
        ` ${String(s.pairs).padStart(5)} ${s.replay.padEnd(12)} ${String(s.rtFindings).padStart(3)}` +
        `  ${(s.caught.join(',') || '-').padEnd(12)}  ${(s.missed.join(',') || '-').padEnd(6)}` +
        ` ${String(s.falsePositives).padStart(3)}  ${s.engineCaught.join(',') || '-'}/${s.engineMissed.join(',') || '-'}/${s.engineNonMatches}`.padEnd(
          32,
        ) +
        ` ${String(s.tokensIn).padStart(7)} ${String(s.tokensOut).padStart(7)} ${(s.costMicroUsd / 1e6).toFixed(4)}`,
    );
}

// ---------------------------------------------------------------------------------------------
// --fetch (public SEC data; no LLM)

export async function fetchCorpus(
  gt: GroundTruth,
  corpusDir: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
  print: (l: string) => void,
): Promise<void> {
  const ua = env['BENCH_USER_AGENT']?.trim();
  if (!ua)
    throw new BenchRefusal('--fetch needs BENCH_USER_AGENT (SEC requires a contact User-Agent)');
  mkdirSync(corpusDir, { recursive: true });
  for (const d of gt.docs.filter((x) => x.origin === 'corpus')) {
    const f = join(corpusDir, d.file);
    if (existsSync(f)) continue;
    const u = new URL(d.url);
    if (u.protocol !== 'https:' || u.hostname !== 'www.sec.gov')
      throw new BenchRefusal(`refusing non-SEC url for ${d.file}`);
    const res = await fetchFn(u, { headers: { 'user-agent': ua }, redirect: 'error' });
    if (!res.ok) throw new BenchRefusal(`fetch ${d.file}: HTTP ${res.status}`);
    writeFileSync(f, new Uint8Array(await res.arrayBuffer()));
    print(`fetched ${d.file}`);
  }
}

export function parseBenchArgs(argv: readonly string[]): BenchOptions & { fetch: boolean } {
  const o: BenchOptions & { fetch: boolean } = {
    mode: 'offline',
    subset: 'verified',
    source: 'authored',
    checkGroundTruth: false,
    fetch: false,
  };
  let modes = 0;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const val = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new BenchRefusal(`${a} needs a value`);
      return v;
    };
    if (a === '--offline') ((o.mode = 'offline'), modes++);
    else if (a === '--live') ((o.mode = 'live'), modes++);
    else if (a === '--check-ground-truth') o.checkGroundTruth = true;
    else if (a === '--fetch') o.fetch = true;
    else if (a === '--subset') {
      const v = val();
      if (v !== 'verified' && v !== 'heldout' && v !== 'all')
        throw new BenchRefusal('--subset is verified, heldout or all');
      o.subset = v;
    } else if (a === '--source') {
      const v = val();
      if (v !== 'authored' && v !== 'live') throw new BenchRefusal('--source is authored or live');
      o.source = v;
    } else if (a === '--max-calls') o.maxCalls = val();
    else if (a === '--max-usd') o.maxUsd = val();
    else if (a === '--corpus') o.corpus = val();
    else throw new BenchRefusal(`unknown argument ${JSON.stringify(a)}`);
  }
  if (modes > 1) throw new BenchRefusal('choose one of --offline or --live');
  return o;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const key = process.env['OPENAI_API_KEY'];
  const print = (l: string) => console.log(`${P}: ${redact(l, key ? [key] : [])}`);
  (async () => {
    const opts = parseBenchArgs(process.argv.slice(2));
    const gt = loadGroundTruth();
    if (opts.fetch) await fetchCorpus(gt, opts.corpus ?? CORPUS_DIR, process.env, fetch, print);
    return runBench(opts, {
      env: process.env,
      fetch: (input, init) => fetch(input, init),
      ledgerStore: () => fileStore(),
      recordings: dirRecordingStore(),
      readDoc: defaultReadDoc,
      print,
      gt,
    });
  })()
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e: unknown) => {
      const refused = e instanceof BenchRefusal;
      print(`${refused ? 'refused' : 'failed'}: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(refused ? 2 : 1);
    });
}
