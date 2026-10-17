import * as Comlink from 'comlink';
import type {
  EngineApi,
  EngineResult,
  EngineSettings,
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

export async function analyzeInWorker(
  bytes: Uint8Array,
  settings: EngineSettings,
  onStage: (s: StageReport) => void,
): Promise<EngineResult> {
  return engine().analyze(bytes, settings, Comlink.proxy(onStage));
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
