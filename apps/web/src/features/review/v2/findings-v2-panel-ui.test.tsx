import 'fake-indexeddb/auto';
import { act, useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VarianceMeta } from '@aduin/core';

// Findings v2 A2-UI: panel ids, groups, progress, bar, Close issue modal, Ask owner (AC-1, AC-3,
// AC-4, AC-6..AC-10, AC-19, E6, E13, E14, E23, E24, E25, E28).
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
const { useCounsel } = await import('../../counsel/counsel-store');
const { CHANGE_OWNER_FIRST } = await import('../../variance/OwnerChip');
const { FindingsPanelV2 } = await import('./FindingsPanelV2');
const h = await import('./test-helpers');
type FindingView = import('../../../engine/types').FindingView;
type Triage = import('../model').Triage;

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
const RESULT = { blocks: [{ id: 'b0', text: 'abc' }], findings: [] };

const E1 = h.fv('e1', 'critical', { order: 1 });
const E2 = h.fv('e2', 'high', { order: 2 });
const E3 = h.fv('e3', 'medium', {
  order: 3,
  detail: { explanation: 'Two readings.', facts: {}, interpretations: ['First', 'Second'] },
});
const C1 = h.changeFv('c1', { order: 4 });
const META: Record<string, VarianceMeta> = {
  c1: { owners: ['gp'], change_type: 'changed_logic' } as unknown as VarianceMeta,
};

interface LiveProps {
  errors: FindingView[];
  changes?: FindingView[];
  meta?: Record<string, VarianceMeta>;
  regressionMeta?: Record<string, VarianceMeta>;
}

function Live({ errors, changes, meta, regressionMeta }: LiveProps) {
  const triage = useReview((s) => s.triage);
  const status = useFilters((s) => s.status);
  const sev = useFilters((s) => s.sev);
  const kind = useFilters((s) => s.kind);
  const view = useMemo(
    () =>
      h.makeView(errors, triage, {
        ...(changes ? { changes } : {}),
        ...(meta ? { meta } : {}),
        ...(regressionMeta ? { regressionMeta } : {}),
        filters: { status, sev, kind },
      }),
    [errors, changes, meta, regressionMeta, triage, status, sev, kind],
  );
  return (
    <div className="work">
      <FindingsPanelV2 view={view} />
    </div>
  );
}

let mounted: { container: HTMLElement; unmount(): void } | null = null;
const q = (sel: string) => mounted!.container.querySelector<HTMLElement>(sel);
const qa = (sel: string) => [...mounted!.container.querySelectorAll<HTMLElement>(sel)];
const row = (id: string) => q(`[data-testid="finding-row"][data-finding-id="${id}"]`)!;
const click = (el: Element | null) =>
  act(() => {
    (el as HTMLElement).click();
  });
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
function setText(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function writeTriage(id: string, t: Triage) {
  useReview.setState({ triage: { ...useReview.getState().triage, [id]: t } });
}

let accept: ReturnType<typeof vi.fn>;
let needsCounsel: ReturnType<typeof vi.fn>;
let dismiss: ReturnType<typeof vi.fn>;
let restore: ReturnType<typeof vi.fn>;

function seed(triage: Record<string, Triage> = {}, selectedId: string | null = null) {
  useReview.setState({ phase: 'ready' });
  useReview.setState({
    doc: DOC,
    result: RESULT as never,
    triage,
    toast: null,
    selectedId,
    memory: null,
  });
}

function mount(props: LiveProps) {
  mounted = h.renderV2(<Live {...props} />);
}

beforeEach(() => {
  h.installDomStubs();
  localStorage.clear();
  useFilters.setState({ ...DEFAULT_FILTERS });
  useOwners.setState({ docId: 'd1', choices: {} });
  useCounsel.setState({ docId: 'd1' });
  accept = vi.fn(async (id: string) => {
    writeTriage(id, { ...(useReview.getState().triage[id] ?? {}), status: 'accepted' });
  });
  needsCounsel = vi.fn(async (id: string) => {
    writeTriage(id, { ...(useReview.getState().triage[id] ?? {}), status: 'counsel' });
  });
  dismiss = vi.fn(async (id: string, reasonCode: string) => {
    writeTriage(id, { status: 'dismissed', reasonCode } as Triage);
    return null;
  });
  restore = vi.fn(async (id: string) => {
    writeTriage(id, { status: 'open' });
  });
  useReview.setState({ accept, needsCounsel, dismiss, restore } as never);
  seed();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  document.body.textContent = '';
});

describe('findings-v2-panel-ui', () => {
  it('should keep the column ids, region, list and progress header (E6, E25, AC-9, AC-19)', () => {
    mount({ errors: [E1, E2, E3] });
    const col = q('[data-testid="findings-column"]')!;
    expect(col.tagName).toBe('ASIDE');
    expect(col.getAttribute('data-fv2')).toBe('1');
    expect(col.getAttribute('aria-label')).toBe('Findings');
    expect(col.getAttribute('data-memory-state')).toBe('none');
    expect(col.classList.contains('fv2')).toBe(true);
    const region = q('[role="region"][aria-label="Findings list"]')!;
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.className).toBe('scroll flist');
    expect(q('ul[data-testid="findings-list"]')).not.toBeNull();
    expect(q('[data-testid="progress-text"]')!.textContent).toBe('0 of 3 reviewed');
    expect(q('[data-testid="progress-header"]')!.textContent).toContain(
      'Counsel 0 · Closed 0 · Left 3',
    );
    const bar = q('[data-testid="progress-bar"]')!;
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    const g = q('[data-testid="group-review"]')!;
    expect(g.getAttribute('data-group')).toBe('review');
    expect(g.getAttribute('data-count')).toBe('3');
    expect(g.textContent).toContain('To review');
    expect(q('[data-testid="group-sent"]')).toBeNull();
    expect(q('[data-testid="panel-resizer"]')).not.toBeNull();
    expect(q('[data-testid="severity-chip-block"]')!.getAttribute('aria-pressed')).toBe('false');
    expect(q('[data-testid="filter-button"]')).not.toBeNull();
    expect(mounted!.container.textContent).not.toContain('Show in document');
  });

  it('should show loading, no-document and no-findings states with the kept ids', () => {
    useReview.setState({ phase: 'loading' });
    mount({ errors: [] });
    expect(q('[data-testid="loading-state"]')!.textContent).toBe('Reading the document…');
    act(() => useReview.setState({ phase: 'empty' }));
    const empty = q('[data-testid="empty-state"]')!;
    expect(empty.textContent).toContain('No document is open.');
    expect(empty.querySelector('button')!.textContent).toContain('Open a document');
    act(() => useReview.setState({ phase: 'ready' }));
    expect(q('[data-testid="empty-state"]')!.textContent).toBe('No findings in this document.');
  });

  it('should disable the bar with nothing open and use the two D1 labels (AC-1, AC-4)', () => {
    mount({ errors: [E1, E2] });
    const ask = q('[data-testid="action-counsel"]') as HTMLButtonElement;
    const close = q('[data-testid="action-dismiss"]') as HTMLButtonElement;
    expect(ask.textContent).toBe('Ask counsel');
    expect(close.textContent).toBe('Close issue');
    expect(ask.disabled).toBe(true);
    expect(close.disabled).toBe(true);
    expect(ask.getAttribute('data-action')).toBe('ask-counsel');
    expect(q('[data-testid="action-bar"]')!.querySelectorAll('button')).toHaveLength(2);
  });

  it('should open one row at a time under the clicked row and keep it open on re-click (AC-6)', () => {
    mount({ errors: [E1, E2, E3] });
    click(row('e1'));
    expect(row('e1').getAttribute('aria-expanded')).toBe('true');
    expect(qa('[data-testid="finding-body"]')).toHaveLength(1);
    expect(row('e1').parentElement!.querySelector('[data-testid="finding-body"]')).not.toBeNull();
    expect(row('e1').parentElement!.className).toBe('fv2-row fv2-row-open');
    click(row('e2'));
    expect(row('e1').getAttribute('aria-expanded')).toBe('false');
    expect(row('e2').getAttribute('aria-expanded')).toBe('true');
    click(row('e2'));
    expect(row('e2').getAttribute('aria-expanded')).toBe('true');
    expect(qa('[data-testid="finding-body"]')).toHaveLength(1);
  });

  it('should keep row attributes and the screen-reader severity word (E28)', () => {
    mount({ errors: [E1, E2, E3] });
    const r = row('e1');
    expect(r.getAttribute('data-kind')).toBe('error');
    expect(r.getAttribute('data-severity')).toBe('block');
    expect(r.getAttribute('data-status')).toBe('open');
    expect(r.textContent).toMatch(/Blocks digitization:/);
    expect(row('e2').textContent).toMatch(/Fix before build:/);
    expect(row('e3').textContent).toMatch(/Note:/);
    expect(r.querySelector('[data-testid="finding-title"]')!.textContent).toBe('Title e1');
  });

  it('should render the D6 block with the counsel draft question, A/B as text and collapsed Details (AC-7)', () => {
    useCounsel.setState({
      docId: 'd1',
      drafts: { edits: { e1: 'Edited question for e1?' }, ai: {}, aiModel: null, useAi: false },
    });
    mount({ errors: [E1, E2, E3] });
    click(row('e1'));
    const body = q('[data-testid="finding-body"]')!;
    expect(body.textContent).toContain('What’s wrong');
    expect(body.querySelector('[data-testid="finding-quote"]')!.textContent).toBe('abc');
    const qfc = body.querySelector(
      'details[data-testid="question-for-counsel"]',
    ) as HTMLDetailsElement;
    expect(qfc.open).toBe(true);
    expect(qfc.textContent).toContain('Edited question for e1?');
    const det = body.querySelector('details[data-testid="finding-details"]') as HTMLDetailsElement;
    expect(det.open).toBe(false);
    expect(det.querySelector('[data-testid="finding-provenance"]')).not.toBeNull();
    click(row('e2'));
    const q2 = q('details[data-testid="question-for-counsel"]') as HTMLDetailsElement;
    expect(q2.open).toBe(false);
    click(row('e3'));
    const q3 = q('details[data-testid="question-for-counsel"]') as HTMLDetailsElement;
    expect(q3.open).toBe(true);
    expect(q3.textContent).toContain('A) First  /  B) Second');
    expect(q3.querySelector('input')).toBeNull();
  });

  it('should ask counsel on a blocking row, move it to Sent and open the next row (AC-2, AC-4, AC-9)', async () => {
    seed({}, 'e1');
    mount({ errors: [E1, E2, E3] });
    await act(async () => {
      (q('[data-testid="action-counsel"]') as HTMLButtonElement).click();
    });
    await flush();
    expect(accept).toHaveBeenCalledWith('e1');
    const sent = q('[data-testid="group-sent"]')!;
    expect(sent.getAttribute('data-count')).toBe('1');
    expect(sent.textContent).toContain('Sent to counsel');
    expect(q('[data-testid="progress-text"]')!.textContent).toBe('1 of 3 reviewed');
    expect(useReview.getState().selectedId).toBe('e2');
    expect(
      useReview.getState().toast!.msg.startsWith('Sent to counsel · Counsel questions now 1'),
    ).toBe(true);
  });

  it('should show "Move back to review" for a sent row and restore it (AC-4)', async () => {
    seed({ e2: { status: 'counsel' } }, 'e2');
    mount({ errors: [E1, E2] });
    const back = q('[data-testid="action-restore"]') as HTMLButtonElement;
    expect(back.textContent).toBe('Move back to review');
    expect(back.getAttribute('data-action')).toBe('move-back');
    expect(q('[data-testid="action-counsel"]')).toBeNull();
    await act(async () => {
      back.click();
    });
    await flush();
    expect(restore).toHaveBeenCalledWith('e2');
    expect(q('[data-testid="group-sent"]')).toBeNull();
  });

  it('should open the Close issue modal with 5 reasons and enforce reason and Other note (AC-3, E25)', async () => {
    seed({}, 'e2');
    mount({ errors: [E1, E2, E3] });
    click(q('[data-testid="action-dismiss"]'));
    const modal = h.queryDoc('[data-testid="dismiss-modal"]')!;
    expect(modal).not.toBeNull();
    expect(modal.querySelector('h2')!.textContent).toBe('Close issue');
    expect(modal.classList.contains('fv2-modal')).toBe(true);
    const reasons = [...modal.querySelectorAll<HTMLInputElement>('[data-testid="dismiss-reason"]')];
    expect(reasons.map((r) => r.getAttribute('data-reason'))).toEqual([
      'real_issue',
      'firm_standard_wording',
      'no_form_impact',
      'tool_false_alarm',
      'other',
    ]);
    const note = modal.querySelector('[data-testid="dismiss-note"]') as HTMLTextAreaElement;
    expect(note.maxLength).toBe(500);
    await act(async () => {
      (modal.querySelector('[data-testid="dismiss-save"]') as HTMLButtonElement).click();
    });
    expect(modal.querySelector('[data-testid="dismiss-error"]')!.textContent).toContain(
      'Choose a reason',
    );
    click(reasons[4]!);
    await act(async () => {
      (modal.querySelector('[data-testid="dismiss-save"]') as HTMLButtonElement).click();
    });
    expect(modal.querySelector('[data-testid="dismiss-error"]')!.textContent).toBe(
      'Add a note for "Other".',
    );
    expect(note.getAttribute('aria-invalid')).toBe('true');
    expect(dismiss).not.toHaveBeenCalled();
    setText(note, ' because ');
    await act(async () => {
      (modal.querySelector('[data-testid="dismiss-save"]') as HTMLButtonElement).click();
    });
    await flush();
    expect(dismiss).toHaveBeenCalledWith('e2', 'other', 'because');
    expect(h.queryDoc('[data-testid="dismiss-modal"]')).toBeNull();
  });

  it('should close a non-blocking row as a real issue through accept', async () => {
    seed({}, 'e2');
    mount({ errors: [E1, E2] });
    click(q('[data-testid="action-dismiss"]'));
    click(h.queryDoc('[data-reason="real_issue"]'));
    await act(async () => {
      (h.queryDoc('[data-testid="dismiss-save"]') as HTMLButtonElement).click();
    });
    await flush();
    expect(accept).toHaveBeenCalledWith('e2');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('should hide Real issue on blocking and change rows and use the re-confirm title (E14, E24)', () => {
    seed({}, 'e1');
    mount({ errors: [E1, E2], changes: [C1], meta: META });
    click(q('[data-testid="action-dismiss"]'));
    expect(h.queryDoc('[data-reason="real_issue"]')).toBeNull();
    expect(document.querySelectorAll('[data-testid="dismiss-reason"]')).toHaveLength(4);
    click(h.queryDoc('[data-testid="dismiss-cancel"]'));
    expect(h.queryDoc('[data-testid="dismiss-modal"]')).toBeNull();
    act(() => useReview.getState().select('c1'));
    click(q('[data-testid="action-dismiss"]'));
    expect(h.queryDoc('[data-reason="real_issue"]')).toBeNull();
    click(h.queryDoc('[data-testid="dismiss-cancel"]'));
    mounted!.unmount();
    mounted = null;
    const reconfirm = h.fv('e9', 'critical');
    seed({}, 'e9');
    const Patch = () => {
      const triage = useReview((s) => s.triage);
      const view = useMemo(() => {
        const v = h.makeView([reconfirm], triage);
        const rows = v.rows.map((r) => ({ ...r, label: 'dismissed_reconfirm' as const }));
        return { ...v, rows, main: rows, visible: rows };
      }, [triage]);
      return <FindingsPanelV2 view={view} />;
    };
    mounted = h.renderV2(<Patch />);
    click(q('[data-testid="action-dismiss"]'));
    expect(h.queryDoc('[data-testid="dismiss-modal"] h2')!.textContent).toBe(
      'Re-confirm this dismissal',
    );
  });

  it('should render Expected and Found with the kept ids inside What\u2019s wrong (P-11)', () => {
    const ef = h.fv('e7', 'high', {
      detail: { explanation: 'x', facts: {}, interpretations: [], expected: 'Section 4' },
      found: 'Section 9',
    } as never);
    seed({}, 'e7');
    mount({ errors: [ef] });
    expect(q('[data-testid="finding-expected"]')!.textContent).toBe('Section 4');
    expect(q('[data-testid="finding-found"]')!.textContent).toBe('Section 9');
  });

  it('should show the New memory tag, the re-confirm bar label and the prior-decision note (P-14, G10, G11)', () => {
    seed({}, 'e1');
    mount({ errors: [E1] });
    expect(q('[data-testid="finding-memory-tag"]')!.textContent).toBe('New');
    expect(q('[data-testid="action-dismiss"]')!.textContent).toBe('Close issue');
    expect(q('.memnote')).toBeNull();
    mounted!.unmount();
    mounted = null;
    const prior = {
      decided_by_name: 'Dana',
      decision: 'dismissed',
      fund_name: 'Fund II',
      decided_at: Date.UTC(2026, 0, 5),
      reason_code: 'no_form_impact',
    };
    const Patch = () => {
      const triage = useReview((s) => s.triage);
      const view = useMemo(() => {
        const v = h.makeView([E1], triage);
        const rows = v.rows.map((r) => ({
          ...r,
          label: 'dismissed_reconfirm' as const,
          prior: prior as never,
        }));
        return { ...v, rows, main: rows, visible: rows };
      }, [triage]);
      return <FindingsPanelV2 view={view} />;
    };
    seed({}, 'e1');
    mounted = h.renderV2(<Patch />);
    expect(q('[data-testid="action-dismiss"]')!.textContent).toBe('Re-confirm dismissal');
    expect(q('[data-testid="action-dismiss"]')!.getAttribute('title')).toBe(
      'Re-confirm dismissal (X)',
    );
    expect(q('[data-testid="finding-memory-tag"]')!.textContent).toBe(
      'Dismissed in Fund II, re-confirm',
    );
    const memo = q('.memnote')!.textContent!;
    expect(memo).toContain(
      'Dana dismissed this in Fund II on 5 Jan 2026 (Does not affect the form).',
    );
    expect(memo).toContain(
      'Blocks digitization, so it stays in the main list until you re-confirm.',
    );
  });

  it('should show "Reason: <label>" as one text node on a dismissed row (G9)', () => {
    useFilters.setState({ status: 'all' });
    seed({ e2: { status: 'dismissed', reasonCode: 'no_form_impact', note: 'n1' } }, 'e2');
    mount({ errors: [E1, E2] });
    const line = q('[data-testid="finding-dismissed-reason"] p')!;
    expect(line.childNodes).toHaveLength(1);
    expect(line.textContent).toBe('Reason: Does not affect the form');
    expect(q('[data-testid="finding-dismissed-reason"]')!.textContent).toContain('n1');
    expect(q('[data-testid="action-restore"]')).not.toBeNull();
  });

  it('should return focus to Close issue after Cancel and to the next row after a save (P-15)', async () => {
    const tick = () =>
      act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    dismiss = vi.fn(async (id: string, reasonCode: string) => {
      writeTriage(id, { status: 'dismissed', reasonCode } as Triage);
      useReview.setState({ selectedId: 'e3' });
      return 'e3';
    });
    useReview.setState({ dismiss } as never);
    seed({}, 'e2');
    mount({ errors: [E1, E2, E3] });
    click(q('[data-testid="action-dismiss"]'));
    click(h.queryDoc('[data-testid="dismiss-cancel"]'));
    await tick();
    expect(document.activeElement).toBe(q('[data-testid="action-dismiss"]'));
    click(q('[data-testid="action-dismiss"]'));
    click(h.queryDoc('[data-reason="tool_false_alarm"]'));
    await act(async () => {
      (h.queryDoc('[data-testid="dismiss-save"]') as HTMLButtonElement).click();
    });
    await flush();
    await tick();
    expect(dismiss).toHaveBeenCalledWith('e2', 'tool_false_alarm', '');
    expect(document.activeElement).toBe(row('e3'));
  });

  it('should list dismissed rows in Closed with the Status filter set to all (P-7) and show done', () => {
    useFilters.setState({ status: 'all' });
    seed({
      e1: { status: 'accepted' },
      e2: { status: 'dismissed', reasonCode: 'tool_false_alarm' },
      e3: { status: 'accepted' },
    });
    mount({ errors: [E1, E2, E3] });
    const closed = q('[data-testid="group-closed"]')!;
    expect(closed.getAttribute('data-count')).toBe('2');
    expect(closed.querySelector('[data-finding-id="e2"]')).not.toBeNull();
    expect(q('[data-testid="group-sent"]')!.getAttribute('data-count')).toBe('1');
    expect(q('[data-testid="group-review"]')).toBeNull();
    expect(q('[data-testid="findings-done"]')!.textContent).toContain('All findings reviewed');
    expect(q('[data-testid="progress-text"]')!.textContent).toBe('3 of 3 reviewed');
  });

  it('should label every control with text that contains its visible text (AC-19)', () => {
    seed({}, 'e1');
    mount({ errors: [E1, E2, E3] });
    for (const b of qa('button')) {
      const label = b.getAttribute('aria-label');
      const text = (b.textContent ?? '').trim();
      if (label && text) expect(label).toContain(text);
    }
  });

  it('should enable Ask owner for suggested owners and send them (E23)', async () => {
    seed({}, 'c1');
    mount({ errors: [E2], changes: [C1], meta: META });
    const ask = q('[data-testid="action-counsel"]') as HTMLButtonElement;
    expect(ask.textContent).toBe('Ask owner');
    expect(q('[data-testid="action-dismiss"]')!.textContent).toBe('Mark as expected...');
    expect(ask.disabled).toBe(false);
    await act(async () => {
      ask.click();
    });
    await flush();
    expect(needsCounsel).toHaveBeenCalledWith('c1', { owners: ['gp'], source: 'suggested' });
  });

  it('should disable Ask owner after an override to You with the owner-first title (E23)', () => {
    useOwners.setState({ docId: 'd1', choices: { c1: 'you' } });
    seed({}, 'c1');
    mount({ errors: [E2], changes: [C1], meta: META });
    const ask = q('[data-testid="action-counsel"]') as HTMLButtonElement;
    expect(ask.disabled).toBe(true);
    expect(ask.title).toBe(CHANGE_OWNER_FIRST);
  });

  it('should let asked owners win over the override (E23)', async () => {
    useOwners.setState({ docId: 'd1', choices: { c1: 'you' } });
    seed({ c1: { status: 'open', ownerAnswers: { counsel: null } } }, 'c1');
    mount({ errors: [E2], changes: [C1], meta: META });
    const ask = q('[data-testid="action-counsel"]') as HTMLButtonElement;
    expect(ask.disabled).toBe(false);
    await act(async () => {
      ask.click();
    });
    await flush();
    expect(needsCounsel).toHaveBeenCalledWith('c1', { owners: ['counsel'], source: 'override' });
  });

  it('should ignore the override of another document (E23)', () => {
    useOwners.setState({ docId: 'other', choices: { c1: 'you' } });
    seed({}, 'c1');
    mount({ errors: [E2], changes: [C1], meta: META });
    expect((q('[data-testid="action-counsel"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('should select the first row with J', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    mount({ errors: [E1, E2] });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    });
    expect(useReview.getState().selectedId).toBe('e1');
    raf.mockRestore();
  });

  describe('code review fixes', () => {
    const press = (k: string) =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      });

    it('R1: a selected row filtered out of the list disables the bar and C/X do nothing', async () => {
      seed({}, 'e1');
      mount({ errors: [E1, E2, E3] });
      act(() => useFilters.setState({ sev: 'note' }));
      expect(row('e3')).not.toBeNull();
      expect(q('[data-finding-id="e1"]')).toBeNull();
      const counsel = q('[data-testid="action-counsel"]') as HTMLButtonElement;
      const close = q('[data-testid="action-dismiss"]') as HTMLButtonElement;
      expect(counsel.disabled).toBe(true);
      expect(close.disabled).toBe(true);
      press('c');
      press('x');
      await flush();
      expect(accept).not.toHaveBeenCalled();
      expect(needsCounsel).not.toHaveBeenCalled();
      expect(h.queryDoc('[data-testid="dismiss-modal"]')).toBeNull();
      expect(useReview.getState().toast).toBeNull();
      expect(useReview.getState().triage.e1).toBeUndefined();
    });

    it('R1: a Previously handled row selected from the document gets no bar actions', () => {
      const prev = h.fv('e9', 'critical', { order: 9 });
      const base = h.makeView([E1, prev]);
      // e9 is shown only under "Previously handled" (open, memory label), not in the v2 list
      const view = {
        ...base,
        main: base.main.filter((r) => r.f.id !== 'e9'),
        visible: base.visible.filter((r) => r.f.id !== 'e9'),
        previous: base.rows.filter((r) => r.f.id === 'e9'),
      };
      seed({}, 'e9');
      mounted = h.renderV2(
        <div className="work">
          <FindingsPanelV2 view={view} />
        </div>,
      );
      expect((q('[data-testid="action-counsel"]') as HTMLButtonElement).disabled).toBe(true);
      expect((q('[data-testid="action-dismiss"]') as HTMLButtonElement).disabled).toBe(true);
      press('c');
      expect(accept).not.toHaveBeenCalled();
      expect(needsCounsel).not.toHaveBeenCalled();
    });

    it('R5: hides the note field for "Real issue"', () => {
      seed({}, 'e2');
      mount({ errors: [E1, E2] });
      click(q('[data-testid="action-dismiss"]'));
      expect(h.queryDoc('[data-testid="dismiss-note"]')).not.toBeNull();
      click(h.queryDoc('[data-reason="real_issue"]'));
      expect(h.queryDoc('[data-testid="dismiss-note"]')).toBeNull();
      click(h.queryDoc('[data-reason="tool_false_alarm"]'));
      expect(h.queryDoc('[data-testid="dismiss-note"]')).not.toBeNull();
    });

    it('R9/R10: a failed save shows an error toast and keeps the modal open', async () => {
      dismiss.mockImplementationOnce(async () => {
        throw new Error('write failed');
      });
      seed({}, 'e2');
      mount({ errors: [E1, E2] });
      click(q('[data-testid="action-dismiss"]'));
      click(h.queryDoc('[data-reason="tool_false_alarm"]'));
      await act(async () => {
        (h.queryDoc('[data-testid="dismiss-save"]') as HTMLButtonElement).click();
      });
      await flush();
      expect(useReview.getState().toast?.msg).toBe('Could not save. Try again.');
      expect(h.queryDoc('[data-testid="dismiss-modal"]')).not.toBeNull();
      expect(useReview.getState().selectedId).toBe('e2');
    });

    it('R8: bar buttons use aria-disabled while busy and ignore clicks', async () => {
      let release: () => void = () => undefined;
      accept.mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            release = () => {
              writeTriage('e1', { status: 'accepted' });
              r();
            };
          }),
      );
      seed({}, 'e1');
      mount({ errors: [E1, E2] });
      const counsel = q('[data-testid="action-counsel"]') as HTMLButtonElement;
      await act(async () => {
        counsel.click();
      });
      const busyBtn = q('[data-testid="action-counsel"]') as HTMLButtonElement;
      expect(busyBtn.disabled).toBe(false);
      expect(busyBtn.getAttribute('aria-disabled')).toBe('true');
      await act(async () => {
        busyBtn.click();
      });
      expect(accept).toHaveBeenCalledTimes(1);
      await act(async () => {
        release();
      });
      await flush();
      expect(useReview.getState().selectedId).toBe('e2');
    });

    it('R18: progress aria-valuemax is at least 1 with no findings', () => {
      mount({ errors: [] });
      expect(q('[data-testid="progress-bar"]')!.getAttribute('aria-valuemax')).toBe('1');
    });
  });
});
