// @vitest-environment node
import {
  buildDocumentRequests,
  maskQuote,
  type DocumentRequest,
  type ExternalReference,
} from '@aduin/core';
import mammoth from 'mammoth';
import { describe, expect, it } from 'vitest';
import {
  buildRequestDocx,
  dedupeRequests,
  requestDocxFilename,
} from '../src/features/counsel/exportRequestDocx';

// Intake Phase 3c (AC-I20, E6, E13): the GP request DOCX lists each missing document once with
// its masked first quote; core quotes are UNMASKED so the export must mask them.
async function text(blob: Blob): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await blob.arrayBuffer()) });
  return value;
}

const PRIMARY = 'a'.repeat(64);
const RAW = 'Wire funds to routing number 021000021 per Annex F.';
const req = (over: Partial<DocumentRequest>): DocumentRequest => ({
  id: '0123456789abcdef',
  targetKey: 'annex:f',
  label: 'Annex F',
  targetFamily: 'annex',
  quote: 'as set out in Annex F',
  count: 1,
  firstDocId: PRIMARY,
  ...over,
});
const META = { firm: 'Partners Group', fund: 'Hartwell Fund III', version: 'v1' };
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe('request-export-contents', () => {
  it('should list every request exactly once with its masked quote', async () => {
    expect(maskQuote(RAW)).not.toBe(RAW);
    const items = [
      req({ quote: RAW, count: 2 }),
      req({
        targetKey: 'side_letter:side letter',
        label: 'Side Letter',
        targetFamily: 'side_letter',
        quote: 'any Side Letter',
      }),
      req({
        targetKey: 'tax_form:w-8ben-e',
        label: 'Form W-8BEN-E',
        targetFamily: 'tax_form',
        quote: 'a completed Form W-8BEN-E',
      }),
    ];
    const t = await text(await buildRequestDocx(META, items, new Date('2026-10-17T00:00:00Z')));
    expect(t).toContain('Missing documents request · Hartwell Fund III');
    expect(t).toContain('Law firm: Partners Group');
    expect(t).toContain('3 documents needed · prepared 2026-10-17');
    for (const l of ['1. Annex F', '2. Side Letter', '3. Form W-8BEN-E'])
      expect(count(t, l)).toBe(1);
    expect(t).toContain(maskQuote(RAW));
    expect(t).not.toContain('021000021');
    expect(t).toContain('Referenced 2 times. First reference:');
    expect(t).toContain('a completed Form W-8BEN-E');
    expect(count(t, 'Status / expected date: ______')).toBe(3);
  });

  it('should keep a duplicated target once after core dedupe and export dedupe', async () => {
    const ref = (start: number, label: string): ExternalReference =>
      ({
        targetKey: 'annex:f',
        targetLabel: label,
        targetFamily: 'annex',
        resolution: 'not_in_package',
        quote: `see ${label} at ${start}`,
        location: { blockIndex: 1, start },
      }) as unknown as ExternalReference;
    const core = buildDocumentRequests([ref(10, 'Annex F'), ref(50, 'Annex F')], PRIMARY);
    expect(core).toHaveLength(1);
    const dup = [...core, req({ targetKey: 'annex:f2', label: 'annex f', count: 3 })];
    expect(dedupeRequests(dup)).toHaveLength(1);
    expect(dedupeRequests(dup)[0]?.count).toBe(5);
    const t = await text(await buildRequestDocx(META, dup));
    expect(count(t, 'Annex F')).toBe(2); // heading + first quote
    expect(t).toContain('1 document needed');
    expect(t).toContain('see Annex F at 10');
  });

  it('should write the empty text, the untagged firm and the filename rule', async () => {
    const t = await text(await buildRequestDocx({ firm: null, fund: null, version: null }, []));
    expect(t).toContain('No missing documents.');
    expect(t).toContain('Law firm: not tagged');
    expect(requestDocxFilename(META)).toBe('missing-documents-hartwell-fund-iii.docx');
    expect(requestDocxFilename({ firm: null, fund: '', version: null })).toBe(
      'missing-documents-document.docx',
    );
  });
});
