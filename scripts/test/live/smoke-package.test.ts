import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liveBase, LiveGuardError, ROOT } from '../../src/live/common';
import {
  choosePackage,
  classify,
  exitCodeFor,
  expectationFor,
  frameOrigin,
  mustAbort,
  RequestRecorder,
} from '../../src/live/smoke-package';

const LIVE = 'https://aduin-transaction-web.giathaowork.workers.dev';
const expected = JSON.parse(
  readFileSync(join(ROOT, 'fixtures', 'package', 'expected.json'), 'utf8'),
) as Parameters<typeof choosePackage>[1];

describe('smoke:live-package', () => {
  it('should refuse any host except the allow-listed workers.dev origin', () => {
    expect(liveBase(LIVE)).toBe(LIVE);
    for (const bad of [
      'http://aduin-transaction-web.giathaowork.workers.dev',
      'https://example.com',
      'https://evil.workers.dev',
      'https://aduin-transaction-web.giathaowork.workers.dev.evil.com',
      'https://aduin-transaction-web.giathaowork.workers.dev:8443',
      'https://aduin-transaction-web.giathaowork.workers.dev/path',
      'http://127.0.0.1:8787',
    ])
      expect(() => liveBase(bad), bad).toThrow(LiveGuardError);
  });

  it('aborts only AI and OCR on the live origin', () => {
    expect(mustAbort(`${LIVE}/api/ai`, LIVE)).toBe(true);
    expect(mustAbort(`${LIVE}/api/ocr`, LIVE)).toBe(true);
    expect(mustAbort(`${LIVE}/api/quota`, LIVE)).toBe(false);
    expect(mustAbort(`${LIVE}/api/aim`, LIVE)).toBe(false);
    expect(mustAbort(`${LIVE}/assets/app.js`, LIVE)).toBe(false);
    expect(mustAbort('https://other.workers.dev/api/ai', LIVE)).toBe(false);
  });

  it('chooses northgate-iii when listed, else hartwell, with facts from expected.json', () => {
    expect(choosePackage(['northgate-iii', 'hartwell'], expected)).toBe('northgate-iii');
    expect(choosePackage(['hartwell'], expected)).toBe('hartwell');
    expect(() => choosePackage(['ngi'], expected)).toThrow(LiveGuardError);
    const ng = expectationFor('northgate-iii', expected);
    expect(ng.requests).toEqual(expected.design['northgate-iii']!.requests);
    const hw = expectationFor('hartwell', expected);
    expect(hw.coverageLine).toBe(expected.hartwell.coverageLine);
    expect(() => expectationFor('nope', expected)).toThrow(LiveGuardError);
  });

  it('records requests, failing POSTs and fulfilled AI/OCR', () => {
    const rec = new RequestRecorder(LIVE);
    rec.onRequest('get', `${LIVE}/`);
    rec.onResponse('GET', `${LIVE}/`, 200);
    rec.onRequest('POST', `${LIVE}/api/session`);
    rec.onResponse('POST', `${LIVE}/api/session`, 403);
    const ai = rec.onRequest('POST', `${LIVE}/api/ai`);
    rec.onAbort(ai);
    expect(rec.requests.map((r) => r.method)).toEqual(['GET', 'POST', 'POST']);
    expect(rec.failingPosts()).toEqual([`403 ${LIVE}/api/session`]);
    expect(rec.aborted).toBe(1);
    expect(rec.fulfilledAiOcr).toBe(0);
    rec.onResponse('POST', `${LIVE}/api/ocr`, 200);
    expect(rec.fulfilledAiOcr).toBe(1);
    rec.onRequest('GET', 'https://challenges.cloudflare.com/cdn-cgi/p/0x4KEY/x');
    expect(rec.requests.at(-1)!.url).toBe('https://challenges.cloudflare.com');
  });

  it('reports only the origin of a console source', () => {
    expect(frameOrigin('https://challenges.cloudflare.com/cdn-cgi/x/0x4ABC/y?z=1')).toBe(
      'https://challenges.cloudflare.com',
    );
    expect(frameOrigin('')).toBe('(no url)');
  });

  it('classifies results and maps exit codes 0/1/2', () => {
    const ok = { checks: { a: true }, failingPosts: [], consoleErrors: [], fulfilledAiOcr: 0 };
    expect(classify(ok)).toBe('pass');
    expect(classify({ ...ok, checks: {} })).toBe('fail');
    expect(classify({ ...ok, checks: { a: true, b: false } })).toBe('fail');
    expect(classify({ ...ok, failingPosts: ['500 x'] })).toBe('fail');
    expect(classify({ ...ok, consoleErrors: ['boom'] })).toBe('fail');
    expect(classify({ ...ok, fulfilledAiOcr: 1 })).toBe('fail');
    expect(exitCodeFor('pass')).toBe(0);
    expect(exitCodeFor('fail')).toBe(1);
    expect(exitCodeFor('bad-args')).toBe(2);
  });
});
