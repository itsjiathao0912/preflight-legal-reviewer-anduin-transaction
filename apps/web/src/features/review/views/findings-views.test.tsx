import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StructureView } from '@aduin/core';

// Document map folded into Findings: view switch, Form flow breaks, Sources rows, nav, counsel.
vi.mock('../../../api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../../ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { useReview } = await import('../../../state/review');
const { useShell } = await import('../../../state/shell');
const { useShare } = await import('../../counsel/counsel-share');
const { useDocFocus } = await import('../../../state/doc-focus');
const { FindingsPanelV2 } = await import('../v2/FindingsPanelV2');
const { navModules, featureFor } = await import('../../registry');
const { flowBreaks, flowPath, questionLine } = await import('./flow-model');
const { sourceRows, sourcesMissing } = await import('./sources-model');
const h = await import('../v2/test-helpers');

const SEC = (n: string, title: string, blockId: string) => ({
  id: `s${n}`,
  number: n,
  title,
  depth: 0 as const,
  restart: false,
  numbering: '',
  refsIn: 0,
  refsOut: 0,
  flags: 0,
  blockId,
});

const STRUCT = {
  version: 1,
  badge: 3,
  counts: {},
  totals: {},
  sectionCount: 3,
  referenceCount: 1,
  sections: [
    SEC('1', 'Subscription', 'b1'),
    SEC('6', 'Classification', 'b6'),
    SEC('9', 'ERISA', 'b9'),
  ],
  crossrefs: [
    {
      id: 'x1',
      text: 'Part B of Section 6',
      where: 'Section 1',
      target: '6B',
      status: 'suspicious',
      quote: 'q',
      expected: null,
      findingId: null,
      issue: true,
      blockId: 'b1',
    },
  ],
  external: [],
  conditions: [
    {
      id: 'c1',
      kind: 'skip',
      text: 't',
      where: 'Section 9',
      condition: 'Benefit Plan Investor',
      target: 'Annex F',
      targetFound: false,
      findingId: 'e1',
      issue: true,
      blockId: 'b9',
    },
  ],
  options: [
    {
      id: 'o1',
      question: 'Investor type',
      where: 'Section 6',
      options: ['A', 'B', 'C'],
      howMany: 'one',
      cueStated: false,
      cueText: null,
      findingId: null,
      issue: true,
      blockId: 'b6',
    },
  ],
  terms: [
    {
      id: 't1',
      term: 'Units',
      definedAt: '',
      uses: 3,
      status: 'none',
      note: '',
      findingId: 'e2',
      issue: true,
      blockId: 'b1',
    },
    {
      id: 't2',
      term: 'Fund',
      definedAt: 'Section 1',
      uses: 3,
      status: 'ok',
      note: '',
      findingId: null,
      issue: false,
      blockId: 'b1',
    },
  ],
  investors: {
    types: [
      {
        type: 'person',
        label: 'Natural person',
        sections: [
          { number: '1', title: 'Subscription' },
          { number: '6', title: 'Classification' },
        ],
        skipped: [],
        questions: [],
        reachesCompletion: true,
        uncertain: false,
        gaps: [],
      },
      {
        type: 'plan',
        label: 'Benefit Plan',
        sections: [
          { number: '1', title: 'Subscription' },
          { number: '6', title: 'Classification' },
          { number: '9', title: 'ERISA' },
        ],
        skipped: [],
        questions: [],
        reachesCompletion: false,
        uncertain: false,
        gaps: [
          {
            id: 'g1',
            kind: 'dead-end',
            item: 'Annex F',
            clause: '',
            where: 'Section 9',
            peers: [],
            findingId: null,
            blockId: 'b9',
          },
        ],
      },
    ],
    completion: null,
    preselected: 'plan',
    sectionTotal: 3,
  },
} as unknown as StructureView;

const DOC = {
  id: 'd1',
  name: 'Doc',
  firmId: null,
  firmName: '',
  fund: 'Fund',
  version: 'v1',
  source: 'sample' as const,
  ref: 'r',
};
const E1 = h.fv('e1', 'critical', { order: 1 });
const E2 = h.fv('e2', 'high', { order: 2 });

let mounted: { container: HTMLElement; unmount(): void } | null = null;
const q = (sel: string) => mounted!.container.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...mounted!.container.querySelectorAll<HTMLElement>(sel)];
const click = (el: Element | null) => act(() => (el as HTMLElement).click());

function mount() {
  const view = h.makeView([E1, E2]);
  mounted = h.renderV2(
    <div className="work">
      <FindingsPanelV2 view={view} />
    </div>,
  );
}

beforeEach(() => {
  h.installDomStubs();
  useShare.setState({ role: 'analyst' });
  useShell.setState({ route: 'findings', findingsView: 'issues', structureFocus: null });
  useReview.setState({ phase: 'ready' });
  useReview.setState({
    doc: DOC,
    result: { blocks: [{ id: 'b0', text: 'abc' }], findings: [E1, E2], structure: STRUCT } as never,
    triage: {},
    toast: null,
    selectedId: null,
    memory: null,
  });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('flow and sources models', () => {
  it('counts real breaks only (cue-inferred option groups are not breaks)', () => {
    expect(flowBreaks(STRUCT).map((b) => b.id)).toEqual(['c1', 'x1', 'g1']);
  });

  it('walks one investor type with questions and breaks inline', () => {
    const p = flowPath(STRUCT, 'plan');
    expect(p.steps.map((s) => s.number)).toEqual(['1', '6', '9']);
    expect(p.steps[2]!.breaks.map((b) => b.id)).toEqual(['c1', 'g1']);
    expect(p.reaches).toBe(false);
    expect(questionLine(p.steps[1]!.questions[0]!)).toBe(
      'Question: Investor type · one answer · 3 options',
    );
    // Section 9 breaks are off the person path
    expect(flowPath(STRUCT, 'person').other.map((b) => b.id)).toEqual(['c1']);
  });

  it('lists only term issues and counts missing items', () => {
    const rows = sourceRows(STRUCT, null, [E1, E2], []);
    expect(rows.map((r) => r.item)).toEqual(['Units']);
    expect(rows[0]!.action).toEqual({ kind: 'finding', findingId: 'e2' });
    expect(sourcesMissing(rows)).toBe(1);
  });
});

describe('Findings view switch', () => {
  it('shows Issues by default with counts, and switches to Form flow and Sources', () => {
    mount();
    expect(q('[data-testid="findings-view-switch"]')).not.toBeNull();
    const issues = q('[data-testid="findings-view-issues"]')!;
    expect(issues.getAttribute('aria-selected')).toBe('true');
    expect(issues.textContent).toBe('Issues 2');
    expect(q('[data-testid="findings-view-flow"]')!.textContent).toBe('Form flow 3 breaks');
    expect(q('[data-testid="findings-view-sources"]')!.textContent).toBe('Sources 1 missing');
    expect(qa('[data-testid="finding-row"]').length).toBe(2);

    click(q('[data-testid="findings-view-flow"]'));
    expect(useShell.getState().findingsView).toBe('flow');
    expect(qa('[data-testid="finding-row"]').length).toBe(0);
    expect(qa('[data-testid="flow-step"]').length).toBe(3);
    const trig = q('[data-testid="flow-type-select"]')!;
    expect(trig.dataset.value).toBe('plan');
    click(trig);
    const opts = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(opts.length).toBe(2);
    const plan = document.querySelector<HTMLElement>('[data-testid="flow-type-plan"]')!;
    expect(plan.getAttribute('aria-selected')).toBe('true');
    const other = opts.find((o) => o !== plan)!;
    click(other);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(q('[data-testid="flow-type-select"]')!.dataset.value).toBe(
      other.dataset.testid!.replace('flow-type-', ''),
    );
    expect(q('[data-testid="flow-type-summary"]')!.textContent).toMatch(
      /^\d+ of 2 reach the signature/,
    );
    expect(q('[data-testid="outline-export"]')).not.toBeNull();
    // the bottom bar stays
    expect(q('[data-testid="action-counsel"]')).not.toBeNull();

    click(q('[data-testid="findings-view-sources"]'));
    expect(qa('[data-testid="sources-row"]').length).toBe(1);
  });

  it('a flow break with a finding opens that finding in Issues', () => {
    useShell.setState({ findingsView: 'flow' });
    mount();
    const brk = qa('[data-testid="flow-break"]').find((b) => b.dataset.kind === 'condition')!;
    expect(brk.textContent).toContain('Branch to Annex F goes nowhere');
    click(brk);
    expect(useShell.getState().findingsView).toBe('issues');
    expect(useReview.getState().selectedId).toBe('e1');
  });

  it('a step shows its section in the document; a break without a finding shows its text', () => {
    useShell.setState({ findingsView: 'flow' });
    mount();
    click(q('[data-testid="flow-step"] .fv2-flow-title'));
    expect(useDocFocus.getState().focus?.blockId).toBe('b1');
    const x = qa('[data-testid="flow-break"]').find((b) => b.dataset.kind === 'crossref')!;
    click(x);
    expect(useShell.getState().findingsView).toBe('flow');
    expect(useDocFocus.getState().focus?.blockId).toBe('b1');
  });

  it('a Sources row opens its finding', () => {
    useShell.setState({ findingsView: 'sources' });
    mount();
    click(q('[data-testid="sources-row"] [data-testid="sources-open-finding"]'));
    expect(useShell.getState().findingsView).toBe('issues');
    expect(useReview.getState().selectedId).toBe('e2');
  });

  it('counsel mode hides the switch and shows Issues', () => {
    useShare.setState({ role: 'counsel' });
    useShell.setState({ findingsView: 'flow' });
    mount();
    expect(q('[data-testid="findings-view-switch"]')).toBeNull();
    expect(q('[data-testid="flow-step"]')).toBeNull();
  });
});

describe('Document map route', () => {
  it('is no longer in the sidebar nav but the route still resolves', () => {
    expect(navModules().map((m) => m.id)).not.toContain('structure');
    expect(featureFor('structure')?.component.name).toBe('FindingsScreen');
  });

  it('redirects to Findings: Form flow, or Sources for a term focus', () => {
    useShell.getState().setRoute('structure');
    expect(useShell.getState()).toMatchObject({ route: 'findings', findingsView: 'flow' });
    useShell.setState({ structureFocus: { tab: 'terms', key: 'units' } });
    useShell.getState().setRoute('structure');
    expect(useShell.getState()).toMatchObject({ route: 'findings', findingsView: 'sources' });
  });
});
