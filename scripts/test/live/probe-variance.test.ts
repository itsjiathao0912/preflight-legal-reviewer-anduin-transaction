import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertLiveBase, LiveGuardError } from '../../src/live/common';
import {
  demoExpectation,
  HC_DIR,
  isFirstParty,
  judge,
  RENDER_BUDGET_MS,
  type VarianceObservation,
} from '../../src/live/probe-variance';
import { mustAbort } from '../../src/live/smoke-package';

// Variance Phase 05 (G2b): offline guard test of the live variance probe (no browser, no network).
const BASE = 'https://aduin-transaction-web.giathaowork.workers.dev';
const exp = demoExpectation();
const ok: VarianceObservation = {
  base: BASE,
  findingsMs: 900,
  changesMs: 1200,
  changeRows: 7,
  newRows: 3,
  logicRows: 4,
  sessionPostStatus: null,
  failingFirstParty: [],
  firstPartyConsoleErrors: [],
  thirdPartyConsoleErrors: ['https://challenges.cloudflare.com'],
  abortedAiOcr: 0,
  fulfilledAiOcr: 0,
};

describe('probe:live-variance', () => {
  it('reads the pinned demo numbers from the authored expected file', () => {
    expect(exp).toEqual({ shown: 7, new: 3, changedLogic: 4 });
    for (const f of ['fund-II.html', 'fund-III.html'])
      expect(existsSync(join(HC_DIR, f))).toBe(true);
  });

  it('passes with 7 rows (3 new, 4 logic) inside the render-first budget and no session POST', () => {
    expect(judge(ok, exp)).toEqual({ verdict: 'pass', reasons: [] });
  });

  it('records third-party (Turnstile iframe) console noise without failing on it', () => {
    expect(isFirstParty('https://challenges.cloudflare.com/cdn-cgi/x', BASE)).toBe(false);
    expect(isFirstParty(`${BASE}/assets/index.js`, BASE)).toBe(true);
    expect(isFirstParty('', BASE)).toBe(true);
    expect(judge({ ...ok, thirdPartyConsoleErrors: ['a', 'b', 'c'] }, exp).verdict).toBe('pass');
  });

  it('fails on wrong counts, a late or missing paint, a failing session POST or first-party errors', () => {
    expect(judge({ ...ok, changeRows: 6 }, exp).verdict).toBe('fail');
    expect(judge({ ...ok, newRows: 2, logicRows: 5 }, exp).verdict).toBe('fail');
    expect(judge({ ...ok, findingsMs: null }, exp).verdict).toBe('fail');
    expect(judge({ ...ok, changesMs: RENDER_BUDGET_MS + 1 }, exp).verdict).toBe('fail');
    expect(judge({ ...ok, sessionPostStatus: 403 }, exp).verdict).toBe('fail');
    expect(judge({ ...ok, failingFirstParty: ['503 GET /api/memory/health'] }, exp).verdict).toBe(
      'fail',
    );
    expect(judge({ ...ok, firstPartyConsoleErrors: ['boom'] }, exp).verdict).toBe('fail');
  });

  it('fails when any AI or OCR request was fulfilled; AI and OCR on the live origin are aborted', () => {
    expect(judge({ ...ok, fulfilledAiOcr: 1 }, exp).verdict).toBe('fail');
    expect(mustAbort(`${BASE}/api/ai`, BASE)).toBe(true);
    expect(mustAbort(`${BASE}/api/ocr`, BASE)).toBe(true);
    expect(mustAbort(`${BASE}/api/memory/health`, BASE)).toBe(false);
  });

  it('targets only the allow-listed https workers.dev origin (shared guard)', () => {
    expect(assertLiveBase(BASE)).toBe(BASE);
    expect(() => assertLiveBase('http://aduin-transaction-web.giathaowork.workers.dev')).toThrow(
      LiveGuardError,
    );
    expect(() => assertLiveBase('https://evil.workers.dev')).toThrow(LiveGuardError);
  });
});
