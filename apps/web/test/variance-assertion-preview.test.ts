import { describe, expect, it } from 'vitest';
import { assertionPreviewText, NO_CHECK_LINE } from '../src/features/variance/AssertionPreview';

// Variance Phase 04 (D1): the firm-template preview line comes from core describeAssertion over the
// worker-decoded assertion candidate; never free text.
describe('variance-assertion-preview', () => {
  it('should show the check the answer creates for R-01 (Appendix C must exist)', () => {
    expect(assertionPreviewText({ kind: 'scope_exists', label: 'appendix c' })).toBe(
      'Creates a check for future documents: Appendix C must exist.',
    );
  });

  it('shows "no automatic check" when the change has no assertion candidate', () => {
    expect(assertionPreviewText(undefined)).toBe(NO_CHECK_LINE);
    expect(NO_CHECK_LINE).toBe('No automatic check for this item.');
  });

  it('normalizes a markup-laden or long label instead of echoing free text', () => {
    const t = assertionPreviewText({ kind: 'scope_exists', label: '  APPENDIX   C  ' });
    expect(t).toContain('Appendix C must exist');
    expect(t).not.toMatch(/<|>/);
  });
});
