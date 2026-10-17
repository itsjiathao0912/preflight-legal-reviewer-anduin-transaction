import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PackageDocument } from '@aduin/core';
import { NO_SUB_LINE, usePackage } from '../../state/package';
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

  it('names each readiness problem in the notice (masked file names)', () => {
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    const ps = el.querySelectorAll('[data-testid="package-problem"]');
    expect(ps).toHaveLength(1);
    expect(ps[0]!.getAttribute('data-code')).toBe('low_confidence_unconfirmed');
    expect(ps[0]!.textContent).toContain('Confirm or fix scan');
    expect(ps[0]!.textContent).not.toContain(SSN);
  });

  it('says when two files are set to To digitize', () => {
    act(() =>
      usePackage.setState((s) => ({
        draft: { ...s.draft!, rows: [row({}), row({ id: 'c'.repeat(64), name: 'b.html' })] },
      })),
    );
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    const ps = el.querySelectorAll('[data-testid="package-problem"]');
    expect(ps).toHaveLength(1);
    expect(ps[0]!.getAttribute('data-code')).toBe('multiple_to_digitize');
    expect(ps[0]!.textContent).toContain('2 files are set to To digitize');
    expect(el.querySelector<HTMLButtonElement>('[data-testid="package-run"]')!.disabled).toBe(true);
  });

  it('says when no file is To digitize, unless there is no sub agreement at all', () => {
    act(() =>
      usePackage.setState((s) => ({ draft: { ...s.draft!, rows: [row({ role: 'reference' })] } })),
    );
    const el = render(<PackageConfirmTable onRun={() => undefined} onBack={() => undefined} />);
    const codes = () =>
      [...el.querySelectorAll('[data-testid="package-problem"]')].map((n) =>
        n.getAttribute('data-code'),
      );
    expect(codes()).toEqual(['no_to_digitize']);
    act(() =>
      usePackage.setState((s) => ({
        draft: { ...s.draft!, rows: [row({ type: 'other', role: 'reference' })] },
      })),
    );
    expect(codes()).toEqual([]);
    expect(el.querySelector('[data-testid="package-notice"]')!.textContent).toContain(NO_SUB_LINE);
  });
});
