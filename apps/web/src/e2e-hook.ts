import { IS_E2E } from './e2e-flag';
import type { BlockView, EngineSettings, FindingView, StageId } from './engine/types';

/**
 * E2E-only seams for the Playwright `preview` build. Every body is guarded by IS_E2E, which is a
 * compile-time `false` outside `--mode e2e`, so production bundles contain none of this
 * (no-e2e-hook-in-dist asserts the marker below is absent from the production build).
 *
 * window.__aduinE2E:
 *   failStage(stage)            inject a stage failure on the next document open (AC3)
 *   transform(fn)               rewrite engine findings before display (seeded findings: gate, reveal)
 *   api                         { seedDecision, seedAnswer, setCounselAnswer, state } bound at install
 */
type Transform = (findings: FindingView[], blocks: BlockView[]) => FindingView[];

interface HookState {
  failStage: StageId | null;
  transform: Transform | null;
}

const state: HookState = { failStage: null, transform: null };

export function e2eSettings(): Pick<EngineSettings, 'e2eFailStage'> {
  if (IS_E2E) {
    return state.failStage ? { e2eFailStage: state.failStage } : {};
  }
  return {};
}

export function e2eTransform(findings: FindingView[], blocks: BlockView[]): FindingView[] {
  if (IS_E2E) {
    return state.transform ? state.transform(findings, blocks) : findings;
  }
  return findings;
}

export function installE2eHook(api: Record<string, unknown>): void {
  if (IS_E2E) {
    (window as unknown as Record<string, unknown>)['__aduinE2E'] = {
      ...api,
      failStage: (s: StageId | null) => {
        state.failStage = s;
      },
      transform: (fn: Transform | null) => {
        state.transform = fn;
      },
    };
  }
}
