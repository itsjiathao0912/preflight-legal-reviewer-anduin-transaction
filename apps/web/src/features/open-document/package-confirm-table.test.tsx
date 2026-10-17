import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PackageDocument } from '@aduin/core';
import { usePackage } from '../../state/package';
import { render } from '../../test-utils';
import { PackageConfirmTable } from './PackageConfirmTable';

// Intake Phase 2 (F3b): reasons shown on every row, a non-colour low mark, accessible selects,
// masked + clamped reasons and file names (validate E4).
function row(over: Partial<PackageDocument>): PackageDocument {
  return {
    id: 'a'.repeat(64),
    name: 'fund-iii-subscription-agreement.html',
    type: 'sub_agreement',
    role: 'to_digitize',
    confidence: 'high',
    reason: 'Title says "subscription agreement"',
    confirmed: false,
    suggestionSource: 'rule',
    needsOcr: false,
    format: 'html',
    titleLines: [],
    ...over,
  };
}

const SSN = '123-45-6789';

beforeEach(() => {
  usePackage.setState({
    draft: {
      status: 'ready',
      tag: { firmId: null, firmName: '', fund: 'Fund III', version: 'v1' },
      rows: [
        row({}),
        row({
          id: 'b'.repeat(64),
          name: `scan ${SSN}.jpg`,
          type: 'other',
          role: 'reference',
          confidence: 'low',
          reason: `Title line mentions ${SSN} and ${'x'.repeat(400)}`,
          needsOcr: true,
          format: 'image',
        }),
      ],
      earlier: [],
      notice: null,
    },
  });
});

describe('package-confirm-table', () => {
  it('shows the fixed reason on every row and a non-colour low mark', () => {
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    const rows = el.querySelectorAll('[data-testid="package-row"]');
    expect(rows).toHaveLength(2);
    for (const r of rows)
      expect(
        r.querySelector('[data-testid="package-row-reason"]')?.textContent?.length,
      ).toBeGreaterThan(0);
    const low = rows[1]!;
    expect(low.getAttribute('data-confidence')).toBe('low');
    expect(low.getAttribute('data-needs-ocr')).toBe('true');
    expect(low.querySelector('[data-testid="package-row-low-mark"]')?.textContent).toContain(
      'Needs your confirmation',
    );
    expect(rows[0]!.querySelector('[data-testid="package-row-low-mark"]')).toBeNull();
    expect(low.textContent).toContain('needs OCR');
  });

  it('selects and confirm controls have accessible names', () => {
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    for (const id of ['package-row-type', 'package-row-role', 'package-row-confirm'])
      for (const n of el.querySelectorAll(`[data-testid="${id}"]`))
        expect(n.getAttribute('aria-label')?.length).toBeGreaterThan(0);
  });

  it('reasons and file names pass through maskAndClamp', () => {
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    const text = el.textContent ?? '';
    expect(text).not.toContain(SSN);
    const reason = el.querySelectorAll('[data-testid="package-row-reason"]')[1]!.textContent!;
    expect(reason.length).toBeLessThanOrEqual(200);
  });

  it('Run checks is disabled until every low row is confirmed', () => {
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    const run = () => el.querySelector<HTMLButtonElement>('[data-testid="package-run"]')!;
    expect(run().disabled).toBe(true);
    act(() => usePackage.getState().confirmDraftRow('b'.repeat(64)));
    expect(run().disabled).toBe(false);
  });
});
