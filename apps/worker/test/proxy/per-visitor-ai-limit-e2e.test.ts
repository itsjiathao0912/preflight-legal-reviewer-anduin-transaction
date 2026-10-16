import { errorStatus, ErrorBodySchema } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { aiBody, frames, makeHarness, send, sendKeep } from '../fakes/harness';

const docHeader = (n: number) => ({ 'x-aduin-doc': n.toString(16).padStart(32, '0') });

describe('per-visitor-ai-limit-e2e (AC32, D-4: 3 fresh-AI documents per visitor per day)', () => {
  test('should return quota_exhausted when the visitor exceeds the daily AI documents', async () => {
    const h = makeHarness();
    let cookie: string | undefined;
    for (let d = 1; d <= 3; d++) {
      h.or.reply(okAi());
      const [res, c] = await sendKeep(h, {
        cookie,
        body: aiBody(`quote ${d}`),
        headers: docHeader(d),
      });
      cookie = c;
      expect(res.status).toBe(200);
      expect((await frames(res)).terminal.t).toBe('result');
    }
    const [res] = await sendKeep(h, { cookie, body: aiBody('quote 4'), headers: docHeader(4) });
    // pre-stream refusal (claim step precedes the first heartbeat): HTTP via errorStatus
    expect(res.status).toBe(errorStatus('quota_exhausted'));
    const body = ErrorBodySchema.parse(await res.json());
    expect(body.error.code).toBe('quota_exhausted');
    expect(body.error.reason).toBe('visitor_limit');
    expect(body.error.retry_after_s).toBeGreaterThan(0);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(h.or.calls).toHaveLength(3); // no upstream call for the refused document
  });

  test('more requests for an already-counted document do not consume a document slot', async () => {
    const h = makeHarness();
    let cookie: string | undefined;
    for (let i = 0; i < 5; i++) {
      h.or.reply(okAi());
      const [res, c] = await sendKeep(h, {
        cookie,
        body: aiBody(`chunk ${i}`),
        headers: docHeader(1),
      });
      cookie = c;
      expect(res.status).toBe(200);
    }
  });

  test('the request ceiling (8/day) also applies within one document', async () => {
    const h = makeHarness();
    let cookie: string | undefined;
    for (let i = 0; i < 8; i++) {
      h.or.reply(okAi());
      const [res, c] = await sendKeep(h, {
        cookie,
        body: aiBody(`chunk ${i}`),
        headers: docHeader(1),
      });
      cookie = c;
      expect(res.status).toBe(200);
    }
    const res = await send(h, { cookie, body: aiBody('chunk 9'), headers: docHeader(1) });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { reason: string } }).error.reason).toBe(
      'visitor_limit',
    );
  });

  test('limits are keyed on cookie claim v: a new v from the same IP gets no extra allowance', async () => {
    const h = makeHarness();
    for (let d = 1; d <= 3; d++) {
      h.or.reply(okAi());
      expect((await send(h, { body: aiBody(`q${d}`), headers: docHeader(d) })).status).toBe(200); // fresh cookie each time
    }
    const res = await send(h, { body: aiBody('q4'), headers: docHeader(4) });
    expect(res.status).toBe(429);
  });

  test('cached sample opens do not count toward the document limit', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    let [res, cookie] = await sendKeep(h, { body: aiBody('sample'), headers: docHeader(9) });
    await res.arrayBuffer();
    for (let i = 0; i < 10; i++) {
      [res, cookie] = await sendKeep(h, { cookie, body: aiBody('sample'), headers: docHeader(9) });
      expect((await frames(res)).terminal).toMatchObject({ t: 'result', cache: 'hit' });
    }
    expect(h.or.calls).toHaveLength(1);
  });

  test('a failure after the stream opens is a terminal error frame with the shared fields', async () => {
    const h = makeHarness();
    h.or.reply({ status: 429, json: {}, headers: { 'retry-after': '30' } });
    const res = await send(h);
    expect(res.status).toBe(200);
    const { terminal } = await frames(res);
    expect(terminal).toMatchObject({
      t: 'error',
      code: 'upstream_failed',
      reason: 'provider_rate_limited',
      retry_after_s: 30,
    });
  });
});
