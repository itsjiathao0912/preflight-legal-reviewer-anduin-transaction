import { cacheKey, parseFrameStream } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import vectors from '../../../../fixtures/cache-key-vectors.json';
import { okAi, okOcr } from '../fakes/openrouter-stub';
import { aiBody, bodyText, frames, makeHarness, send } from '../fakes/harness';
import { keys } from '../../src/limits/policy';
import { aiMessages, digestHex } from '../../src/upstream/openrouter';
import { DEFAULT_TEXT_MODELS } from '../../src/config';

describe('llm-ocr-cache-hit (AC27)', () => {
  test('imported cacheKey() matches fixtures/cache-key-vectors.json', () => {
    for (const v of vectors.vectors as {
      input?: Parameters<typeof cacheKey>[0];
      key?: string;
      rejects?: boolean;
    }[]) {
      if (v.input && v.key) expect(cacheKey(v.input)).toBe(v.key);
    }
  });

  test('the key is derived from the forwarded payload (hash of final messages), not client hashes', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    const body = aiBody('Subject to this Section 11.', { ext: { input_hash: 'f'.repeat(64) } });
    await frames(await send(h, { body }));
    const forwarded = JSON.stringify(h.or.calls[0]!.json['messages']);
    const expected = cacheKey({
      kind: 'ai',
      input_hash: await digestHex(forwarded),
      model: DEFAULT_TEXT_MODELS.split(',')[0]!,
      prompt_ver: 'p1',
      schema_ver: 's1',
      rules_hash: 'none',
    });
    expect([...h.platform.cacheMap.keys()]).toEqual([expected]);
    const shaped = aiMessages({
      law_firm_id: null,
      candidates: [{ id: 'c1', quote: 'Subject to this Section 11.', section_path: ['1'] }],
      tier: 'default',
    });
    expect(shaped).toBe(forwarded);
  });

  test('should serve a cache hit without calling upstream', async () => {
    const h = makeHarness();
    h.or.reply(
      okAi([
        {
          candidate_id: 'c1',
          issue_class: 'broken_cross_reference',
          severity: 'medium',
          confidence: 0.8,
          quote: 'this Section 11',
          explanation: 'No Section 11.',
        },
      ]),
    );
    const first = await frames(await send(h));
    expect(first.terminal).toMatchObject({ t: 'result', cache: 'miss' });
    // exhaust every cap and drop the Turnstile token: a hit must still be served
    const k = keys('any', 'any', h.clock.now);
    for (const [key, n] of [[k.global, 999]] as const) h.platform.set(key, n);
    for (const id of [...h.platform.counts.keys()]) h.platform.counts.set(id, 999);
    const calls = h.platform.calls;
    const writes = h.platform.writes;
    const claimsBefore = h.platform.claimLog.length;
    const res = await send(h, { turnstile: null });
    const text = await bodyText(res);
    const { terminal } = parseFrameStream(text);
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'hit' });
    expect(h.or.calls).toHaveLength(1); // zero upstream calls on the hit
    expect(h.ts.calls).toBe(1); // no siteverify on the hit
    expect(h.platform.writes - writes).toBe(0); // zero writes (no hits counter, no ledger)
    expect(h.platform.claimLog.length - claimsBefore).toBe(0); // zero claims
    expect(h.platform.calls - calls).toBe(1); // exactly the cache read
  });

  test('OCR hits too, with zero claims and zero writes', async () => {
    const h = makeHarness();
    h.or.reply(okOcr());
    await frames(await send(h, { path: '/api/ocr' }));
    const writes = h.platform.writes;
    const { terminal } = await frames(await send(h, { path: '/api/ocr' }));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ocr', cache: 'hit' });
    expect(h.platform.writes).toBe(writes);
    expect(h.or.calls).toHaveLength(1);
  });

  test('a different input misses', async () => {
    const h = makeHarness();
    h.or.reply(okAi(), okAi());
    await frames(await send(h));
    const { terminal } = await frames(await send(h, { body: aiBody('a different clause') }));
    expect(terminal).toMatchObject({ cache: 'miss' });
    expect(h.or.calls).toHaveLength(2);
  });

  test('cache key components containing "|" are rejected by the imported cacheKey', () => {
    expect(() =>
      cacheKey({
        kind: 'ai',
        input_hash: 'a|b',
        model: 'm:free',
        prompt_ver: 'p1',
        schema_ver: 's1',
        rules_hash: 'none',
      }),
    ).toThrow();
  });
});
