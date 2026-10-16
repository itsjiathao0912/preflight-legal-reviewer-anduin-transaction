import { describe, expect, it } from 'vitest';
import { MEMORY_LABELS, type ActiveDecision, type MemoryLabel } from '../../src/contracts/memory';
import { resolveLabel } from '../../src/memory/label';
import type { Severity } from '../../src/findings/severity';

const FP = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const DATA_MODEL_CHECK = [
  'new',
  'previously_dismissed',
  'already_answered',
  'awaiting_counsel',
  'dismissed_reconfirm',
];

function expected(
  decision: ActiveDecision['decision'],
  status: ActiveDecision['status'],
  blocking: boolean,
  match: boolean,
  option?: string,
): MemoryLabel {
  if (status !== 'active' || !match) return 'new';
  if (decision === 'dismissed') return blocking ? 'dismissed_reconfirm' : 'previously_dismissed';
  if (decision === 'answered') return option && option !== 'unclear' ? 'already_answered' : 'new';
  return 'awaiting_counsel';
}

describe('memory-label-matrix (AC43)', () => {
  it('MemoryLabel values equal the DATA-MODEL memory_label CHECK list (E5)', () => {
    expect([...MEMORY_LABELS].sort()).toEqual([...DATA_MODEL_CHECK].sort());
  });

  it('no active decision -> new', () => {
    expect(
      resolveLabel({ severity: 'critical', issue_class: 'ambiguity', fingerprint: FP }, null),
    ).toBe('new');
  });

  it('should label dismissed blocking finding as dismissed_reconfirm', () => {
    const d = { fingerprint: FP, status: 'active', decision: 'dismissed' } as const;
    expect(
      resolveLabel({ severity: 'high', issue_class: 'broken_cross_reference', fingerprint: FP }, d),
    ).toBe('dismissed_reconfirm');
    expect(
      resolveLabel(
        { severity: 'critical', issue_class: 'broken_cross_reference', fingerprint: FP },
        d,
      ),
    ).toBe('dismissed_reconfirm');
    expect(
      resolveLabel(
        { severity: 'medium', issue_class: 'broken_cross_reference', fingerprint: FP },
        d,
      ),
    ).toBe('previously_dismissed');
  });

  it('exhaustive table: decision x status x severity x fingerprint-match x counsel option', () => {
    let n = 0;
    const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
    for (const decision of ['dismissed', 'accepted', 'answered'] as const) {
      for (const status of ['active', 'superseded', 'revoked'] as const) {
        for (const severity of severities) {
          for (const match of [true, false]) {
            for (const option of [undefined, 'A', 'B', 'C', 'unclear'] as const) {
              const d: Pick<
                ActiveDecision,
                'fingerprint' | 'status' | 'decision' | 'counsel_option'
              > = { fingerprint: FP, status, decision };
              if (option) d.counsel_option = option;
              const label = resolveLabel(
                { severity, issue_class: 'ambiguity', fingerprint: match ? FP : OTHER },
                d,
              );
              expect(label).toBe(
                expected(
                  decision,
                  status,
                  severity === 'critical' || severity === 'high',
                  match,
                  option,
                ),
              );
              expect(DATA_MODEL_CHECK).toContain(label);
              n++;
            }
          }
        }
      }
    }
    expect(n).toBe(3 * 3 * 4 * 2 * 5);
  });

  it('revoked and superseded decisions never match; a finding without a fingerprint (no firm) is new', () => {
    for (const status of ['revoked', 'superseded'] as const) {
      expect(
        resolveLabel(
          { severity: 'low', issue_class: 'ambiguity', fingerprint: FP },
          { fingerprint: FP, status, decision: 'dismissed' },
        ),
      ).toBe('new');
    }
    expect(
      resolveLabel(
        { severity: 'low', issue_class: 'ambiguity', fingerprint: null },
        { fingerprint: FP, status: 'active', decision: 'dismissed' },
      ),
    ).toBe('new');
  });
});
