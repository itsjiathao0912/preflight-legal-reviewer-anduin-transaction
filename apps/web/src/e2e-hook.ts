import { setApiBaseValue } from './api/base';
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
 *   setFirmRules(texts)         stub active firm rules (sandbox firm with rules: no `.none` lookup)
 *   setApiBase(base)            switch the AI lane on in the preview build (G16; only the five AI
 *                               specs call it, before opening a document, with /api/* intercepted)
 *   forceInvalidOutline(on)     make the next outline export fail schema validation (Phase 09)
 *   useRealMemory(on)           Phase 08b: use the real Worker memory client (with setApiBase('/'))
 *                               so a spec can answer /api/** through a page.route fake Worker
 *   api                         { seedDecision, seedAnswer, setCounselAnswer, state } bound at install
 */
type Transform = (findings: FindingView[], blocks: BlockView[]) => FindingView[];

interface HookState {
  failStage: StageId | null;
  firmRules: string[] | null;
  transform: Transform | null;
  forceInvalidOutline: boolean;
  realMemory: boolean;
}

const state: HookState = {
  failStage: null,
  firmRules: null,
  transform: null,
  forceInvalidOutline: false,
  realMemory: false,
};

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

/** E2E-only: active firm rule texts the stub memory API returns (null = the stub default []). */
export function e2eFirmRules(): string[] | null {
  if (IS_E2E) {
    return state.firmRules;
  }
  return null;
}

/** E2E-only: true when the next outline export must fail validation (false outside IS_E2E). */
export function e2eForceInvalidOutline(): boolean {
  if (IS_E2E) {
    return state.forceInvalidOutline;
  }
  return false;
}

/** E2E-only: true when a spec asked for the real Worker memory client (false outside IS_E2E). */
export function e2eRealMemory(): boolean {
  if (IS_E2E) {
    return state.realMemory;
  }
  return false;
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
      setFirmRules: (texts: string[] | null) => {
        state.firmRules = Array.isArray(texts) ? texts.filter((t) => typeof t === 'string') : null;
      },
      forceInvalidOutline: (on: boolean) => {
        state.forceInvalidOutline = on === true;
      },
      useRealMemory: (on: boolean) => {
        state.realMemory = on === true;
      },
      // the only runtime writer of the API base; stays inside the IS_E2E block (E21a)
      setApiBase: (base: string) => {
        setApiBaseValue(typeof base === 'string' ? base : '');
      },
    };
  }
}
