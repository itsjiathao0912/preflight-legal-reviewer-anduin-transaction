// @vitest-environment node
import mammoth from 'mammoth';
import { describe, expect, it } from 'vitest';
import {
  buildFinalDocx,
  finalDocxFilename,
  type FinalQuestion,
} from '../src/features/counsel/exportDocx';

// counsel-share-link plan, gate `export-final-docx`: the final DOCX handed to digitization carries
// every question with the recorded answer, counsel's note and who answered.
async function text(blob: Blob): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await blob.arrayBuffer()) });
  return value;
}

const META = {
  title: 'Counsel answers · NGI',
  firm: 'Partners Group',
  fund: 'NGI',
  version: '2026',
};

const Q = (over: Partial<FinalQuestion>): FinalQuestion => ({
  number: 1,
  text: 'Which section holds the custodian fields?',
  location: 'Section 6',
  quote: 'Custodian details go in Part B.',
  interpretations: ['Part B of Section 6', 'Part B of Annex 1'],
  option: 'B',
  note: 'Use Annex 1.',
  by: 'Anna Counsel',
  at: Date.UTC(2026, 9, 19, 12),
  ...over,
});

describe('export-final-docx', () => {
  it('should contain the answer, the reading, the note and the answerer name', async () => {
    const t = await text(
      await buildFinalDocx(META, [
        Q({}),
        Q({
          number: 2,
          text: 'Is clause 4 a typo?',
          option: 'unclear',
          note: undefined,
          by: 'Ben',
        }),
        Q({
          number: 3,
          text: 'No answer here',
          option: null,
          note: undefined,
          by: undefined,
          at: undefined,
        }),
      ]),
    );
    expect(t).toContain('Ready to digitize');
    expect(t).toContain('1. Which section holds the custodian fields?');
    expect(t).toContain('Answer: Option B: Part B of Annex 1');
    expect(t).toContain('Note: Use Annex 1.');
    expect(t).toContain('Answered by: Anna Counsel on 2026-10-19');
    expect(t).toContain('Answer: Unclear');
    expect(t).toContain('Answered by: Ben');
    expect(t).toContain('Answer: No answer recorded');
    expect(t).toContain('Law firm: Partners Group');
  });

  it('should mask sensitive data in free text', async () => {
    const t = await text(
      await buildFinalDocx(META, [Q({ note: 'Wire to routing number 021000021 first.' })]),
    );
    expect(t).not.toContain('021000021');
  });

  it('should name the file after the fund', () => {
    expect(finalDocxFilename(META)).toBe('final-answers-ngi.docx');
  });
});
