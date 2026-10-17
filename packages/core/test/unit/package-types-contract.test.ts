import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { DocFormat, PackageDocFormat } from '../../src/index';
import { PackageAnalysisSchema, PackageDocFormatSchema } from '../../src/package/index';
import { PKG, REPO } from '../helpers/package-fixtures';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
// type-level guards (G1): the adapters' DocFormat is not shadowed by the package module
export type DocFormatUnchanged = Expect<Equal<DocFormat, 'html' | 'pdf' | 'docx' | 'jpeg' | 'png'>>;
export type PackageFormat = Expect<
  Equal<PackageDocFormat, 'html' | 'pdf' | 'docx' | 'ocr' | 'image'>
>;

describe('package-types-contract', () => {
  it('should deep-equal the committed PackageAnalysis JSON schema snapshot', () => {
    const snap = JSON.parse(readFileSync(`${PKG}schema.v1.json`, 'utf8'));
    expect(z.toJSONSchema(PackageAnalysisSchema)).toEqual(snap);
  });

  it('keeps the frozen contracts snapshot file present (unchanged by this module)', () => {
    const snap = readFileSync(
      `${REPO}packages/core/test/__snapshots__/contracts.json-schema.snap`,
      'utf8',
    );
    expect(snap.length).toBeGreaterThan(1000);
    expect(snap).not.toContain('package-analysis');
  });

  it('exports the package format union only as PackageDocFormat', () => {
    expect(PackageDocFormatSchema.options).toEqual(['html', 'pdf', 'docx', 'ocr', 'image']);
  });

  it('rejects unknown keys and a wrong schema literal (strict)', () => {
    const base = {
      schema: 'package-analysis.v1',
      documents: [],
      references: [],
      terms: [],
      coverage: [],
      requests: [],
      dropped: 0,
    };
    expect(PackageAnalysisSchema.safeParse(base).success).toBe(true);
    expect(PackageAnalysisSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(PackageAnalysisSchema.safeParse({ ...base, schema: 'v2' }).success).toBe(false);
  });
});
