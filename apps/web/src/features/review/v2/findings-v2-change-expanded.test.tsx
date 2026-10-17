import 'fake-indexeddb/auto';
import { act, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VarianceMeta } from '@aduin/core';

// Findings v2 A2-UI: change and regression rows keep Variance parts in the accordion (AC-20, E23, E28).
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
const { useFilters, DEFAULT_FILTERS } = await import('../../../state/filters');
const { useOwners } = await import('../../variance/owner-store');
const { CHANGE_OWNER_FIRST } = await import('../../variance/OwnerChip');
const { FindingsPanelV2 } = await import('./FindingsPanelV2');
const { buildOwnerAsk } = await import('./use-ask-owners');
const h = await import('./test-helpers');
type Triage = import('../model').Triage;

const DOC = {
  id: 'd1',
  name: 'Doc',
  firmId: 'f1',
  firmName: 'Firm',
  fund: 'Fund',
  version: 'v2',
  source: 'sample' as const,
  ref: 'r',
};
const RESULT = { blocks: [{ id: 'b0', text: 'abc' }], findings: [] };

const meta = (over: Partial<VarianceMeta>): VarianceMeta =>
  ({
    owners: ['gp'],
    change_type: 'changed_logic',
    kind: 'change',
    old_text: 'The old clause applies.',
    new_text: 'The new clause applies.',
    impact: null,
    rule_id: 'VAR-LOGIC',
    variance_rules_version: 'v1',
    variance_rules_hash8: 'abcd1234',
    owner_reason: 'Economic terms go to the GP.',
    ...over,
  }) as unknown as VarianceMeta;

const C1 = h.changeFv('c1', { order: 1 });
const N1 = h.changeFv('n1', { order: 2 });
const R1 = h.changeFv('r1', {
  order: 3,
  severity: 'critical',
  pattern_key: 'VAR-REG-SCOPE-EXISTS',
});
const PASS_META = { c1: meta({}), n1: meta({ change_type: 'new', owners: [] }) };
const REG_META = { r1: meta({ kind: 'regression', owners: ['counsel'] }) };

function Live({ triage }: { triage?: Record<string, Triage> }) {
  const t = useReview((s) => s.triage);
  const view = useMemo(
    () =>
      h.makeView([], triage ?? t, {
        changes: [C1, N1, R1],
        meta: PASS_META,
        regressionMeta: REG_META,
      }),
    [t, triage],
  );
  return (
    <div className="work">
      <FindingsPanelV2 view={view} />
    </div>
  );
}

let mounted: { container: HTMLElement; unmount(): void } | null = null;
const q = (sel: string) => mounted!.container.querySelector<HTMLElement>(sel);
const row = (id: string) => q(`[data-testid="finding-row"][data-finding-id="${id}"]`)!;
const askBtn = () => q('[data-testid="action-counsel"]') as HTMLButtonElement;
let needsCounsel: ReturnType<typeof vi.fn>;

function seed(selectedId: string | null, triage: Record<string, Triage> = {}) {
  useReview.setState({ phase: 'ready' });
  useReview.setState({ doc: DOC, result: RESULT as never, triage, selectedId, memory: null });
}

beforeEach(() => {
  h.installDomStubs();
  localStorage.clear();
  useFilters.setState({ ...DEFAULT_FILTERS });
  useOwners.setState({ docId: 'd1', choices: {} });
  needsCounsel = vi.fn(async () => undefined);
  useReview.setState({ needsCounsel } as never);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  document.body.textContent = '';
});

describe('findings-v2-change-expanded', () => {
  it('should keep change-row attributes, chips and the owner chip on the row (E28)', () => {
    seed(null);
    mounted = h.renderV2(<Live />);
    const c = row('c1');
    expect(c.getAttribute('data-kind')).toBe('change');
    expect(c.getAttribute('data-change-type')).toBe('changed_logic');
    expect(c.hasAttribute('data-regression')).toBe(false);
    expect(c.querySelector('[data-testid="change-type"]')!.textContent).toBe(
      'Logic: change vs baseline. ',
    );
    expect(c.querySelector('[data-testid="owner-chip"]')!.textContent).toBe('GP');
    expect(c.querySelector('[data-testid="finding-title"]')).not.toBeNull();
    expect(row('n1').querySelector('[data-testid="change-type"]')!.textContent).toContain('New');
    const r = row('r1');
    expect(r.getAttribute('data-kind')).toBe('change');
    expect(r.getAttribute('data-regression')).toBe('1');
    expect(r.querySelector('[data-testid="change-type"]')!.textContent).toContain('Regression');
  });

  it('should render the Variance parts inside the accordion body (AC-20)', () => {
    seed('c1');
    mounted = h.renderV2(<Live />);
    const body = q('[data-testid="finding-body"]')!;
    expect(body.querySelector('[data-testid="change-diff"]')).not.toBeNull();
    expect(body.querySelector('[data-testid="owner-select"]')).not.toBeNull();
    expect(body.querySelector('[data-testid="owner-reason"]')!.textContent).toContain(
      'Economic terms go to the GP.',
    );
    expect(body.querySelector('[data-testid="change-provenance"]')!.textContent).toContain(
      'Rule VAR-LOGIC · deterministic',
    );
    expect(body.textContent).toContain('Change vs baseline');
    expect(body.querySelector('[data-testid="action-counsel"]')).toBeNull();
  });

  it('should take regression owners from regression meta (E23)', async () => {
    seed('r1');
    mounted = h.renderV2(<Live />);
    expect(q('[data-testid="finding-body"]')!.textContent).toContain('Firm-template check');
    expect(askBtn().disabled).toBe(false);
    await act(async () => {
      askBtn().click();
    });
    expect(needsCounsel).toHaveBeenCalledWith('r1', { owners: ['counsel'], source: 'suggested' });
  });

  it('should disable Ask owner with CHANGE_OWNER_FIRST when there are no owners (AC-20)', () => {
    seed('n1');
    mounted = h.renderV2(<Live />);
    expect(askBtn().disabled).toBe(true);
    expect(askBtn().title).toBe(CHANGE_OWNER_FIRST);
  });

  it('should enable Ask owner for suggested gp and build {owners:[gp], source:suggested} (E23)', async () => {
    seed('c1');
    mounted = h.renderV2(<Live />);
    expect(askBtn().disabled).toBe(false);
    const view = h.makeView([], {}, { changes: [C1], meta: PASS_META });
    expect(buildOwnerAsk(view.rows[0]!, view)).toEqual({ owners: ['gp'], source: 'suggested' });
    await act(async () => {
      askBtn().click();
    });
    expect(needsCounsel).toHaveBeenCalledWith('c1', { owners: ['gp'], source: 'suggested' });
  });

  it('should disable Ask owner after an override to You (E23)', () => {
    useOwners.setState({ docId: 'd1', choices: { c1: 'you' } });
    seed('c1');
    mounted = h.renderV2(<Live />);
    expect(askBtn().disabled).toBe(true);
    expect(askBtn().title).toBe(CHANGE_OWNER_FIRST);
    const view = h.makeView([], {}, { changes: [C1], meta: PASS_META });
    expect(buildOwnerAsk(view.rows[0]!, view)).toBeNull();
  });

  it('should let asked owners win over the override (E23)', () => {
    useOwners.setState({ docId: 'd1', choices: { c1: 'you' } });
    const triage: Record<string, Triage> = { c1: { status: 'open', ownerAnswers: { gp: null } } };
    seed('c1', triage);
    mounted = h.renderV2(<Live />);
    expect(askBtn().disabled).toBe(false);
    const view = h.makeView([], triage, { changes: [C1], meta: PASS_META });
    expect(buildOwnerAsk(view.rows[0]!, view)).toEqual({ owners: ['gp'], source: 'override' });
  });

  it('should return no ask for an error row', () => {
    const view = h.makeView([h.fv('e1', 'high')]);
    expect(buildOwnerAsk(view.rows[0]!, view)).toBeNull();
  });
});
