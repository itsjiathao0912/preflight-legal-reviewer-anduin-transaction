import * as Comlink from 'comlink';
import type { EngineApi, EngineResult, EngineSettings, StageReport } from './types';

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
