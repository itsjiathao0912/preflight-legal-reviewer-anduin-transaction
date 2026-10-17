// Phase 05 review L2: shapeAi masks candidate quotes server-side (idempotent), so a client that
// skipped the core masking never forwards raw account digits upstream.
import { mask, sensitiveSpans } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { shapeAi } from '../../src/proxy/guards';
import { aiBody, frames, makeHarness, send } from '../fakes/harness';
import { okAi } from '../fakes/openrouter-stub';

const RAW = 'Wire funds to account 021000021 at First Bank.';

describe('shape-ai-server-mask (review L2)', () => {
  test('raw account digits in a candidate quote are masked by shapeAi', () => {
    const s = shapeAi(aiBody(RAW));
    expect(s.candidates[0]!.quote).not.toContain('021000021');
    expect(s.candidates[0]!.quote).toBe(mask(RAW, sensitiveSpans(RAW)));
  });

  test('idempotent: an already-masked quote is forwarded unchanged', () => {
    const once = mask(RAW, sensitiveSpans(RAW));
    expect(shapeAi(aiBody(once)).candidates[0]!.quote).toBe(once);
    const plain = 'Subject to this Section 11, the Investor agrees.';
    expect(shapeAi(aiBody(plain)).candidates[0]!.quote).toBe(plain);
  });

  test('the upstream body never carries the raw digits', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    const res = await send(h, { body: aiBody(RAW) });
    await frames(res);
    expect(h.or.calls).toHaveLength(1);
    expect(h.or.calls[0]!.body).not.toContain('021000021');
  });
});
