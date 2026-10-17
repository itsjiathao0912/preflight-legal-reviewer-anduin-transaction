import 'fake-indexeddb/auto';
import { parseQuestionKey, questionKey } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import type { FindingView } from '../src/engine/types';
import { readQuestionIds, saveQuestionIds } from '../src/features/counsel/question-ids';
import { buildRows, type Triage } from '../src/features/review/model';
import { questionItems } from '../src/features/variance/owner-groups';

// Variance Phase 04 (B2): ONE keying rule. Change findings get `<findingId>@<owner>` per asked owner;
// error findings keep the plain id; an id that already contains "@" stays intact.
function fv(id: string, extra: Partial<FindingView> = {}) {
  return {
    id,
    severity: 'critical',
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: [],
    quote: 'q',
    quote_snippet: 'q',
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    title: id,
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const change = (id: string) => fv(id, { kind: 'change', issue_class: 'version_drift' });

describe('variance-question-ids', () => {
  it('should enumerate error keys as plain ids and change keys as <findingId>@<owner>', () => {
    const triage: Record<string, Triage> = {
      e1: { status: 'counsel' },
      c1: { status: 'counsel', ownerAnswers: { gp: null, counsel: null } },
      'odd@id': { status: 'counsel', ownerAnswers: { fund_admin: null } },
      c2: { status: 'open' },
    };
    const rows = buildRows([fv('e1'), change('c1'), change('odd@id'), change('c2')], null, triage);
    const keys = questionItems(rows).map((q) => q.key);
    expect(keys).toEqual(['e1', 'c1@counsel', 'c1@gp', 'odd@id@fund_admin']);
    // every key round-trips through the one parser
    for (const q of questionItems(rows)) {
      const p = parseQuestionKey(q.key);
      expect(p.findingId).toBe(q.findingId);
      expect(p.owner).toBe(q.change ? q.owner : undefined);
      expect(questionKey(q.findingId, q.change ? q.owner : undefined)).toBe(q.key);
    }
    // an error finding is never given an owner suffix
    expect(keys.filter((k) => k.startsWith('e1@'))).toEqual([]);
  });

  it('two owners give two question records, each answerable alone', () => {
    const rows = buildRows([change('c1')], null, {
      c1: { status: 'counsel', ownerAnswers: { gp: 'A', counsel: null } },
    });
    const items = questionItems(rows);
    expect(items.map((q) => [q.key, q.answer])).toEqual([
      ['c1@counsel', null],
      ['c1@gp', 'A'],
    ]);
  });

  it('readQuestionIds / saveQuestionIds are keyed by the composite question key', async () => {
    const doc = 'q'.repeat(64);
    await saveQuestionIds(doc, { [questionKey('c1', 'gp')]: 'cq_gp', e1: 'cq_e1' });
    await saveQuestionIds(doc, { [questionKey('c1', 'counsel')]: 'cq_counsel' });
    expect(await readQuestionIds(doc)).toEqual({
      'c1@gp': 'cq_gp',
      e1: 'cq_e1',
      'c1@counsel': 'cq_counsel',
    });
  });
});
