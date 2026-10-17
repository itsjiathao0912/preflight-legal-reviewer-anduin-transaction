import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DIFF_STAGES,
  DiffErrorSchema,
  DiffResultSchema,
  type DiffResult,
  type DiffStage,
} from '../../../src/diff/index';
import * as barrel from '../../../src/index';
import { diffOk, fixtureSide } from './diff-helpers';

describe('diff contract (A1)', () => {
  it('exports a JSON-schema-convertible DiffResult and a code-only error shape', () => {
    const js = z.toJSONSchema(DiffResultSchema) as { properties: Record<string, unknown> };
    expect(Object.keys(js.properties).sort()).toEqual(
      [
        'clauses',
        'definitions',
        'fees',
        'findingsDelta',
        'mode',
        'notice',
        'possibleLeftovers',
        'renames',
        'requirements',
        'sections',
        'summary',
      ].sort(),
    );
    expect(Object.keys(z.toJSONSchema(DiffErrorSchema) as object)).toContain('properties');
  });

  it('DiffStage is its own vocabulary, distinct from the web StageId', () => {
    expect(DIFF_STAGES).toEqual(['read', 'parse', 'structure', 'detect', 'diff']);
    const s: DiffStage = 'detect';
    expect(DIFF_STAGES).toContain(s);
  });

  it('is re-exported from the core barrel and round-trips as plain JSON', () => {
    expect(barrel.diffDocuments).toBeTypeOf('function');
    expect(barrel.DiffResultSchema).toBe(DiffResultSchema);
    const r: DiffResult = diffOk(
      fixtureSide('sibling-A.html'),
      fixtureSide('sibling-B.html'),
      'sibling',
    );
    expect(DiffResultSchema.parse(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
});
