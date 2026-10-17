import { describe, expect, it } from 'vitest';
import { judge, requestCarriesToken, VIOLATION_INIT } from '../../src/live/probe-session';

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
