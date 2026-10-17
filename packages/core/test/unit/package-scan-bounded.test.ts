import { describe, expect, it } from 'vitest';
import type { Block } from '../../src/model/types';
import {
  extractExternalReferences,
  extractPackageDefinitions,
  extractUsedTerms,
} from '../../src/package/index';

const block = (text: string): Block =>
  ({
    id: 'b0',
    kind: 'paragraph',
    lines: [{ text, cue: { bold: false, caps: false, indent: 0, position: 'unknown' } }],
    section_path: [],
    scopeId: 's',
    anchor: { docHash: 'h', blockId: 'b0', offsetStart: 0, offsetEnd: text.length },
  }) as Block;

const HOSTILE = [
  'A'.repeat(1_000_000),
  'Annex '.repeat(160_000),
  'the Capital '.repeat(80_000),
  'Form W-8BEN'.repeat(90_000),
  '“'.repeat(500_000) + 'Units” means',
  ('Partnership Agreement ' + 'x'.repeat(30)).repeat(20_000),
];

describe('package-scan-bounded (G20)', () => {
  it.each(HOSTILE.map((h, i) => [i, h] as const))(
    'hostile input %i finishes under the bound',
    (_i, text) => {
      const blocks = [block(text)];
      const t0 = performance.now();
      extractExternalReferences(blocks, { docId: 'a'.repeat(64), scopeLabels: [] });
      extractPackageDefinitions('a'.repeat(64), blocks);
      const terms = extractUsedTerms(blocks, []);
      expect(terms.length).toBeLessThanOrEqual(200);
      expect(performance.now() - t0).toBeLessThan(4000);
    },
  );
});
