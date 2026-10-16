import { describe, expect, it } from 'vitest';
import { htmlToLines, MAX_FRAME_DEPTH, MAX_PARSE_DEPTH } from '../../src/adapters/html';
import { CoreError } from '../../src/model/errors';

/**
 * nesting-DoS (F1). Before the fix every text node rescanned the whole frame stack (O(n^2) in
 * our code) and htmlparser2's own open-element stack uses Array#unshift (O(n^2) in the library).
 * Now: our lookups are O(1), our frame stack is capped at MAX_FRAME_DEPTH, and total depth past
 * MAX_PARSE_DEPTH is rejected with payload_too_large. Locally each case is < 100 ms; the 1500 ms
 * budget gives >10x headroom for slow shared CI yet fails hard on any quadratic regression
 * (the pre-fix code needed seconds for 80k nested tags).
 */
const BUDGET_MS = 1500;
const run = (
  html: string,
): { ms: number; result?: ReturnType<typeof htmlToLines>; error?: unknown } => {
  const t = performance.now();
  try {
    const result = htmlToLines(html);
    return { ms: performance.now() - t, result };
  } catch (error) {
    return { ms: performance.now() - t, error };
  }
};
const rejectedCleanly = (e: unknown) => e instanceof CoreError && e.code === 'payload_too_large';

describe('html nesting DoS', () => {
  it("'<b>a' x 80000 finishes within budget (rejected by the depth cap)", () => {
    const r = run('<b>a'.repeat(80_000));
    expect(r.ms).toBeLessThan(BUDGET_MS);
    expect(rejectedCleanly(r.error)).toBe(true);
  });

  it("'<div>a' x 80000 finishes within budget (rejected by the depth cap)", () => {
    const r = run('<div>a'.repeat(80_000));
    expect(r.ms).toBeLessThan(BUDGET_MS);
    expect(rejectedCleanly(r.error)).toBe(true);
  });

  it('~10 MB nested input is rejected cleanly within budget', () => {
    const unit = '<span>x';
    const r = run(unit.repeat(Math.floor((10 * 1024 * 1024 - 1024) / unit.length)));
    expect(r.ms).toBeLessThan(BUDGET_MS);
    expect(rejectedCleanly(r.error)).toBe(true);
  });

  it('deep but under-cap nesting is processed within budget and keeps bold', () => {
    const r = run('<b>a'.repeat(MAX_PARSE_DEPTH - 16));
    expect(r.error).toBeUndefined();
    expect(r.ms).toBeLessThan(BUDGET_MS);
    expect(r.result!.lines.length).toBeGreaterThan(0);
    expect(r.result!.lines.every((l) => l.cue.bold)).toBe(true);
  });

  it('over-cap string is rejected before encoding', () => {
    expect(() => htmlToLines('a'.repeat(10 * 1024 * 1024 + 1))).toThrow(CoreError);
  });

  it('elements deeper than the frame cap close cleanly and shallow styling is preserved', () => {
    const n = MAX_FRAME_DEPTH + 50;
    const r = htmlToLines(`<p><b>${'<i>'.repeat(n)}Hello${'</i>'.repeat(n)}</b></p><p>plain</p>`);
    expect(r.lines.map((l) => [l.text, l.cue.bold])).toEqual([
      ['Hello', true],
      ['plain', false],
    ]);
  });
});
