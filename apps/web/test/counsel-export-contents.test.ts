// @vitest-environment node
import {
  buildCounselSheet,
  type GateState,
  type MemoryLabel,
  type SheetFinding,
} from '@aduin/core';
import mammoth from 'mammoth';
import { describe, expect, it } from 'vitest';
import { buildCounselDocx, docxFilename, DOCX_MIME } from '../src/features/counsel/exportDocx';

const ACCOUNT = '021000021';
const f = (id: string, quote: string, issue_class = 'broken_cross_reference'): SheetFinding => ({
  id,
  severity: 'critical',
  detector_kind: 'rule',
  issue_class,
  location: `Section ${id.slice(1)}`,
  quote,
});

async function text(blob: Blob): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await blob.arrayBuffer()) });
  return value;
}

const META = {
  title: 'Counsel query sheet · NGI',
  firm: 'Partners Group',
  fund: 'NGI',
  version: '2026',
};

describe('counsel-export-contents', () => {
  it('should export a docx that contains every unanswered question and interpretation', async () => {
    const findings = [
      f('f1', 'Custodian details go in Part B of Section 6.'),
      f('f2', 'Wire funds to routing number 021000021 before closing.', 'ambiguity'),
      f('f3', 'Answered already in this document.'),
      f('f4', 'Fund I answered this one.'),
      f('f5', 'Still awaiting counsel from fund I.'),
      f('f6', 'Counsel said unclear.'),
    ];
    const states: Record<string, GateState> = {
      f1: { status: 'counsel' },
      f2: { status: 'accepted' },
      f3: { status: 'counsel', counselAnswer: 'A' },
      f4: { status: 'counsel' },
      f5: { status: 'counsel' },
      f6: { status: 'counsel', counselAnswer: 'unclear' },
    };
    const labels: Record<string, MemoryLabel> = {
      f4: 'already_answered',
      f5: 'awaiting_counsel',
    };
    const sheet = buildCounselSheet(META, findings, states, labels);
    expect(sheet.questions.map((q) => q.findingKey)).toEqual(['f1', 'f2', 'f6']);
    const wording: Record<string, string> = {
      f1: 'Which section holds the custodian fields?',
      f2: `Should account ${ACCOUNT} stay in the form?`,
      f6: 'Please confirm the reading again.',
    };
    const blob = await buildCounselDocx(sheet, (k) => wording[k] ?? '', new Date('2026-10-17'));
    expect(blob.type).toBe(DOCX_MIME);
    const out = await text(blob);
    expect(out).toContain('Counsel query sheet · NGI');
    expect(out).toContain('Law firm: Partners Group · Fund: NGI · Version: 2026');
    expect(out).toContain('1. Which section holds the custodian fields?');
    expect(out).toContain('Section 1 · "Custodian details go in Part B of Section 6."');
    expect(out).toContain('3. Please confirm the reading again.');
    for (const q of sheet.questions)
      for (const [i, t] of q.interpretations.entries())
        expect(out).toContain(`${'ABCDEF'[i]}. ${t}`);
    // only unanswered New/Accepted: answered here, already answered and awaiting counsel are absent
    expect(out).not.toContain('Answered already in this document.');
    expect(out).not.toContain('Fund I answered this one.');
    expect(out).not.toContain('Still awaiting counsel from fund I.');
    // zero repeated questions (AC45)
    const nums = [...out.matchAll(/^(\d+)\. /gm)].map((m) => m[1]);
    expect(nums).toEqual(['1', '2', '3']);
    // masked quotes and masked wording: the account number never appears
    expect(out).not.toContain(ACCOUNT);
    expect(out).toContain('#0021');
    expect(out.match(/Answer: ______/g)).toHaveLength(3);
  });

  it('should write an empty-sheet notice when nothing is unanswered', async () => {
    const sheet = buildCounselSheet(
      META,
      [f('f1', 'q')],
      { f1: { status: 'counsel', counselAnswer: 'C' } },
      {},
    );
    const out = await text(await buildCounselDocx(sheet, () => 'x'));
    expect(out).toContain('No unanswered questions.');
    expect(out).toContain('0 questions for counsel');
  });

  it('should name the file after the fund', () => {
    expect(docxFilename({ ...META, fund: 'Partners Group NGI 2026!' })).toBe(
      'counsel-questions-partners-group-ngi-2026.docx',
    );
    expect(docxFilename({ title: '', firm: null, fund: null, version: null })).toBe(
      'counsel-questions-document.docx',
    );
  });
});
