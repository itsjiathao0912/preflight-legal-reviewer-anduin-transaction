import { describe, expect, it } from 'vitest';
import { eligibleBaselines, type BaselineCandidate } from '../../src/package/index';

const c = (
  docId: string,
  firmId: string | null,
  packageId: string,
  createdAt?: string,
): BaselineCandidate => ({
  docId,
  name: `${docId}.docx`,
  firmId,
  packageId,
  ...(createdAt ? { createdAt } : {}),
});

describe('package-baseline-eligibility (AC-I9 pure half)', () => {
  const pool = [
    c('same-pkg', 'firm-x', 'p1', '2026-10-01'),
    c('same-firm-other-pkg', 'firm-x', 'p2', '2026-10-05'),
    c('other-firm-identical-text', 'firm-y', 'p3', '2026-10-09'),
    c('null-firm-other-pkg', null, 'p4'),
  ];

  it('returns same-firm candidates only, newest first', () => {
    expect(eligibleBaselines({ id: 'p1', firmId: 'firm-x' }, pool).map((x) => x.docId)).toEqual([
      'same-firm-other-pkg',
      'same-pkg',
    ]);
  });

  it('two firms with identical text never cross', () => {
    expect(eligibleBaselines({ id: 'p9', firmId: 'firm-y' }, pool).map((x) => x.docId)).toEqual([
      'other-firm-identical-text',
    ]);
  });

  it('a null-firm package sees within-package candidates only', () => {
    const r = eligibleBaselines({ id: 'p4', firmId: null }, pool);
    expect(r.map((x) => x.docId)).toEqual(['null-firm-other-pkg']);
    expect(
      eligibleBaselines({ id: 'p1', firmId: null }, [c('n', null, 'p1'), c('x', null, 'p2')]).map(
        (x) => x.docId,
      ),
    ).toEqual(['n']);
  });

  it('rejects a same-package candidate whose non-null firm differs (defense in depth)', () => {
    expect(eligibleBaselines({ id: 'p1', firmId: 'firm-x' }, [c('bad', 'firm-y', 'p1')])).toEqual(
      [],
    );
  });

  it('orders by createdAt desc, then name, and is pure', () => {
    const input = [c('b', 'f', 'p'), c('a', 'f', 'p'), c('z', 'f', 'p', '2026-01-01')];
    const copy = JSON.stringify(input);
    expect(eligibleBaselines({ id: 'p', firmId: 'f' }, input).map((x) => x.docId)).toEqual([
      'z',
      'a',
      'b',
    ]);
    expect(JSON.stringify(input)).toBe(copy);
  });
});
