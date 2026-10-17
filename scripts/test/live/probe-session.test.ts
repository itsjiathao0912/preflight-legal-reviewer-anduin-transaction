import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FIRM_SAMPLE_ID,
  judge,
  requestCarriesToken,
  VIOLATION_INIT,
} from '../../src/live/probe-session';
import { ROOT } from '../../src/live/common';

const base = {
  mode: 'headless' as const,
  sessionStatus: 200,
  tokenSent: true,
  violations: [] as string[],
  cookie: 'c',
};

describe('probe:live-session', () => {
  it('passes with token, 200 session, cookie and zero CSP violations', () => {
    expect(judge(base).verdict).toBe('pass');
  });
  it('fails on any securitypolicyviolation or a non-200 session', () => {
    expect(judge({ ...base, violations: ['script-src https://x'] }).verdict).toBe('fail');
    expect(judge({ ...base, sessionStatus: 403 }).verdict).toBe('fail');
    expect(judge({ ...base, tokenSent: false }).verdict).toBe('fail');
  });
  it('no token and no POST is residual R2 (E24: client stays quiet)', () => {
    expect(judge({ ...base, sessionStatus: null, tokenSent: false, cookie: null }).verdict).toBe(
      'residual',
    );
  });
  it('detects a token in a header or JSON body', () => {
    expect(requestCarriesToken({ 'cf-turnstile-response': 'tok' }, null)).toBe(true);
    expect(requestCarriesToken({}, JSON.stringify({ turnstile_token: 'tok' }))).toBe(true);
    expect(requestCarriesToken({}, JSON.stringify({ turnstile_token: '' }))).toBe(false);
    expect(requestCarriesToken({}, 'not json')).toBe(false);
  });
  it('the CSP listener script carries no e2e hook marker', () => {
    expect(VIOLATION_INIT).toContain('securitypolicyviolation');
    expect(VIOLATION_INIT).not.toContain('__aduinE2E');
  });
});

describe('probe-session sample choice (Wave C finding)', () => {
  it('opens a bundled sample whose law firm resolves, so the session bootstrap runs', () => {
    // build-samples.ts has side effects on import; read its tag table as text.
    const src = readFileSync(join(ROOT, 'scripts', 'src', 'build-samples.ts'), 'utf8');
    const m = new RegExp(`'${FIRM_SAMPLE_ID}':\\s*\\{[^}]*?firmId:\\s*([^,]+),`).exec(src);
    expect(m).not.toBeNull();
    expect(m?.[1]?.trim()).not.toBe('null');
  });
});
