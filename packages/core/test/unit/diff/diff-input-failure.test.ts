import { describe, expect, it } from 'vitest';
import {
  DIFF_STAGES,
  DiffErrorSchema,
  diffDocuments,
  type SideInput,
} from '../../../src/diff/index';
import { fixtureSide } from './diff-helpers';

const good = fixtureSide('sibling-A.html');
const SECRET_TEXT = 'Account Number';
const failed = (stage: (typeof DIFF_STAGES)[number], code: string): SideInput => ({
  ok: false,
  stage,
  code,
});

describe('diff-input-failure', () => {
  it('should name side A when input A cannot be read', () => {
    const o = diffDocuments({ a: failed('read', 'payload_too_large'), b: good, mode: 'version' });
    expect(o).toEqual({ error: { side: 'a', stage: 'read', code: 'payload_too_large' } });
    expect(DiffErrorSchema.safeParse((o as { error: unknown }).error).success).toBe(true);
  });

  it('should name side B when input B cannot be read', () => {
    for (const stage of DIFF_STAGES) {
      const o = diffDocuments({ a: good, b: failed(stage, 'unsupported_type'), mode: 'sibling' });
      expect(o).toEqual({ error: { side: 'b', stage, code: 'unsupported_type' } });
    }
  });

  it('reports side a first when both sides fail', () => {
    const o = diffDocuments({
      a: failed('parse', 'unknown'),
      b: failed('read', 'payload_too_large'),
      mode: 'version',
    });
    expect(o).toEqual({ error: { side: 'a', stage: 'parse', code: 'unknown' } });
  });

  it('carries no document or message text in the serialized payload', () => {
    // a hostile side input that smuggles text into code / stage is reduced to fixed tokens
    const hostile = {
      ok: false,
      stage: 'bogus',
      code: `${SECRET_TEXT}: 990000017 boom`,
    } as unknown as SideInput;
    for (const [a, b, side] of [
      [hostile, good, 'a'],
      [good, hostile, 'b'],
    ] as const) {
      const o = diffDocuments({ a, b, mode: 'version' });
      expect(o).toEqual({ error: { side, stage: 'read', code: 'unknown' } });
      const wire = JSON.stringify(o);
      expect(wire).not.toContain(SECRET_TEXT);
      expect(wire).not.toMatch(/\d{4,}/);
      expect(wire).not.toContain('boom');
    }
  });

  it('never throws on malformed input', () => {
    const bad = [
      undefined,
      null,
      {},
      { ok: true },
      { ok: true, structure: {}, findings: [] },
    ] as unknown as SideInput[];
    for (const x of bad) {
      expect(() => diffDocuments({ a: x, b: good, mode: 'version' })).not.toThrow();
      expect(diffDocuments({ a: x, b: good, mode: 'version' })).toEqual({
        error: { side: 'a', stage: 'read', code: 'invalid_request' },
      });
      expect(diffDocuments({ a: good, b: x, mode: 'version' })).toEqual({
        error: { side: 'b', stage: 'read', code: 'invalid_request' },
      });
    }
    expect(() => diffDocuments(undefined as never)).not.toThrow();
  });
});
