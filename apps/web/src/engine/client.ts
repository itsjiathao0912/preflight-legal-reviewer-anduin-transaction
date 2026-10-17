import * as Comlink from 'comlink';
import type {
  AnalyzeInput,
  DiffDocumentsInput,
  DiffDocumentsResponse,
  EngineApi,
  EngineResult,
  EngineSettings,
  ReadPackageDocResponse,
  StageReport,
  VerifyAiContext,
  VerifyAiResponse,
} from './types';

/** Main-thread Comlink client for the engine worker (one worker per page). */
let remote: Comlink.Remote<EngineApi> | null = null;

function engine(): Comlink.Remote<EngineApi> {
  if (!remote) {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
      type: 'module',
      name: 'engine',
    });
    remote = Comlink.wrap<EngineApi>(worker);
  }
  return remote;
}

/**
 * Phase 06: the last analyze input per byte buffer. The AI lane re-analyzes with the same bytes
 * object when a graph was evicted (LRU 2); remembering the input keeps PDF / DOCX / OCR documents
 * on their own adapter instead of being re-read as HTML.
 */
const inputOf = new WeakMap<Uint8Array, AnalyzeInput>();

/** Analyze a document: a discriminated input (Phase 06) or bare bytes (HTML, the Phase 03 form). */
export async function analyzeInWorker(
  input: AnalyzeInput | Uint8Array,
  settings: EngineSettings,
  onStage: (s: StageReport) => void,
): Promise<EngineResult> {
  let send: AnalyzeInput | Uint8Array = input;
  if (ArrayBuffer.isView(input)) send = inputOf.get(input) ?? input;
  return engine().analyze(send, settings, Comlink.proxy(onStage));
}

/** Remember which analyze input a byte buffer stands for (re-analysis after LRU eviction). */
export function rememberInput(bytes: Uint8Array, input: AnalyzeInput): void {
  inputOf.set(bytes, input);
}

/** Phase 05: verify an AI result against a retained document (plain strings in, FindingViews out). */
export async function verifyAiInWorker(
  result: unknown,
  docHash: string,
  injectedRuleTexts: string[],
  ctx: VerifyAiContext,
): Promise<VerifyAiResponse> {
  return engine().verifyAi(result, docHash, injectedRuleTexts, ctx);
}

/** Phase 05: rulesHash8 for the precomputed lookup (computed in the worker, G12). */
export async function rulesHash8InWorker(ruleTexts: string[]): Promise<string> {
  return engine().rulesHash8(ruleTexts);
}

/**
 * Phase 07: diff two documents in the engine worker. Logs the worker-measured time as `diff-ms <n>`
 * (AC29 e2e hook); never logs document text.
 */
export async function diffInWorker(input: DiffDocumentsInput): Promise<DiffDocumentsResponse> {
  const out = await engine().diffDocuments(input);
  if ('result' in out) console.info(`diff-ms ${out.ms}`);
  return out;
}

/** Intake Phase 2: light read of one package member in the engine worker (code-only failure). */
export async function readPackageDocInWorker(
  input: AnalyzeInput,
  opts: { name: string },
): Promise<ReadPackageDocResponse> {
  try {
    return await engine().readPackageDoc(input, opts);
  } catch {
    return { ok: false, code: 'unknown' };
  }
}
