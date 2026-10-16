import { describe, expect, it } from 'vitest';
import { htmlToLines } from '../../src/adapters/html';
import { analyzeHtml } from '../../src/engine';
import { limits } from '../../src/config/limits';
import { CoreError } from '../../src/model/errors';

describe('adapter-size-cap', () => {
  it('rejects input larger than limits.maxHtmlBytes with payload_too_large (no partial model)', () => {
    const big = new Uint8Array(limits.maxHtmlBytes + 1).fill(0x61);
    let err: unknown;
    try {
      htmlToLines(big);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CoreError);
    expect((err as CoreError).code).toBe('payload_too_large');
    expect(() => analyzeHtml(big)).toThrow(CoreError);
  });
  it('accepts input exactly at the cap', () => {
    const at = new Uint8Array(limits.maxHtmlBytes).fill(0x61);
    expect(() => htmlToLines(at)).not.toThrow();
  });
});
