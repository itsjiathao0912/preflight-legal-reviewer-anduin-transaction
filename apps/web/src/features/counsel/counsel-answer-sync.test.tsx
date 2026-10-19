import 'fake-indexeddb/auto';
import type { CounselSheetResponse } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSheet } from '../../api/counselShareApi';
import { useReview, type DocMeta } from '../../state/review';
import { setCounselMode } from '../../state/share-role';
import * as h from '../review/v2/test-helpers';
import { refreshSheet, useShare } from './counsel-share';
import { itemState, needsAnswer, questionRows } from './sheet-model';
import { questionItems } from '../variance/owner-groups';

// Counsel answers on the share link reach the analyst: sheet poll -> merge -> question answered,
// gate drops that blocking item. A sheet answer of "unclear" keeps the item blocking.
vi.mock('../../api/counselShareApi', async (orig) => ({
  ...(await orig<typeof import('../../api/counselShareApi')>()),
  getSheet: vi.fn(),
}));

const FP = 'a'.repeat(64);
const DOC: DocMeta = {
  id: 'd1',
  name: 'Doc',
  firmId: 'kirkland',
  firmName: 'Kirkland',
  fund: 'Fund III',
  version: 'v1',
  source: 'sample',
  sampleId: '01',
  ref: '01.html',
};
const E1 = h.fv('e1', 'critical', { order: 1 });
const E2 = h.fv('e2', 'critical', { order: 2 });

function sheet(option: 'A' | 'unclear'): CounselSheetResponse {
  return {
    participants: [{ name: 'Anna Counsel', joined_at: 1 }],
    role: 'analyst',
    doc_ref: 'sample:01',
    questions: ['e1', 'e2'].map((id) => ({
      id: `q_${id}`,
      finding_id: id,
      finding_key: id,
      fingerprint: FP,
      issue_class: 'broken_cross_reference',
      severity: 'critical',
      location: 'Section 6',
      quote_masked: 'x',
      status: 'exported',
      interpretations: [],
      created_at: 1,
    })),
    answers: [
      {
        id: 'a1',
        question_id: 'q_e1',
        option,
        answered_by_name: 'Anna Counsel',
        answered_at: 10,
      },
    ],
    comments: [],
    decisions: [],
    ready_at: null,
  } as CounselSheetResponse;
}

beforeEach(() => {
  setCounselMode(false);
  useShare.setState({ role: 'analyst', sheet: null, link: null });
  useReview.setState({
    doc: DOC,
    phase: 'ready',
    result: { blocks: [{ id: 'b0', text: 'abc' }], findings: [E1, E2] } as never,
    // e1 Accepted (blocking critical), e2 Needs counsel
    triage: { e1: { status: 'accepted' }, e2: { status: 'counsel' } },
    memory: null,
  });
});
afterEach(() => vi.mocked(getSheet).mockReset());

describe('counsel answer on the share link resolves the analyst question', () => {
  it('should merge a clear answer within one poll and drop that gate item only', async () => {
    const before = h.makeView([E1, E2], useReview.getState().triage);
    expect(before.gate.reasons.length).toBe(2);
    vi.mocked(getSheet).mockResolvedValue(sheet('A'));
    await refreshSheet();
    expect(getSheet).toHaveBeenCalledWith('sample:01');
    const t = useReview.getState().triage.e1!;
    expect(t.counselAnswer).toBe('A');
    expect(t.answeredBy).toBe('Anna Counsel');
    const view = h.makeView([E1, E2], useReview.getState().triage);
    const items = questionItems(view.rows);
    const q1 = items.find((q) => q.findingId === 'e1')!;
    expect(itemState(q1)).toBe('answered');
    expect(needsAnswer(q1.row)).toBe(false);
    expect(questionRows(view.rows).length).toBe(2);
    expect(view.gate.reasons.length).toBe(1);
    expect(view.gate.reasons.map((r) => r.findingKey)).not.toContain('e1');
  });

  it('should keep the question blocking when counsel answers unclear', async () => {
    vi.mocked(getSheet).mockResolvedValue(sheet('unclear'));
    await refreshSheet();
    const view = h.makeView([E1, E2], useReview.getState().triage);
    expect(view.gate.reasons.length).toBe(2);
  });
});

describe('Questions row tag for a shared question', () => {
  it('should read Awaiting counsel when shared and unanswered, and name who answered', async () => {
    const { QuestionRow } = await import('./QuestionRow');
    const view = h.makeView([E1], { e1: { status: 'accepted' } });
    const q = questionItems(view.rows)[0]!;
    const props = {
      q,
      n: 1,
      selected: false,
      mode: 'view' as const,
      defaultBy: 'Counsel',
      onToggle: () => undefined,
      onMode: () => undefined,
    };
    let m = h.renderV2(
      <ul>
        <QuestionRow {...props} questionId="q_e1" />
      </ul>,
    );
    expect(document.body.querySelector('[data-testid="counsel-row-awaiting"]')?.textContent).toBe(
      'Awaiting counsel',
    );
    m.unmount();
    m = h.renderV2(
      <ul>
        <QuestionRow {...props} />
      </ul>,
    );
    expect(document.body.querySelector('[data-testid="counsel-row-awaiting"]')).toBeNull();
    m.unmount();
    const answered = h.makeView([E1], {
      e1: { status: 'accepted', counselAnswer: 'A', answeredBy: 'Anna Counsel', answeredAt: 10 },
    });
    const qa = questionItems(answered.rows)[0]!;
    m = h.renderV2(
      <ul>
        <QuestionRow {...props} q={qa} questionId="q_e1" />
      </ul>,
    );
    expect(document.body.querySelector('[data-testid="counsel-row-answered"]')?.textContent).toBe(
      'Answered by Anna Counsel',
    );
    m.unmount();
  });
});
