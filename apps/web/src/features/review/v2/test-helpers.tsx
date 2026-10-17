import type { VarianceGatePolicy, VarianceMeta } from '@aduin/core';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { FindingView } from '../../../engine/types';
import { DEFAULT_FILTERS, type Filters } from '../../../state/filters';
import { mergeFindings, reviewCounts, reviewGate } from '../../variance/select';
import { buildRows, placement, visibleRows, type Triage } from '../model';
import type { ReviewView } from './types';

/**
 * Findings v2 test-only harness (E7, E25). `src/test-utils.tsx` keeps a module-level container and
 * no root, so it cannot be unmounted; this helper owns its own root and returns `unmount`.
 */
export function renderV2(ui: ReactElement): { container: HTMLElement; unmount(): void } {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** jsdom gaps used by the v2 components: ResizeObserver, matchMedia, scrollIntoView, pointer capture. */
export function installDomStubs(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.ResizeObserver) g.ResizeObserver = ResizeObserverStub;
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.scrollIntoView !== 'function') proto.scrollIntoView = function () {};
  if (typeof proto.setPointerCapture !== 'function') proto.setPointerCapture = function () {};
  if (typeof proto.releasePointerCapture !== 'function')
    proto.releasePointerCapture = function () {};
  if (typeof proto.hasPointerCapture !== 'function') proto.hasPointerCapture = () => false;
}

/** Portal-aware query: Radix dialogs portal to document.body, outside the render container. */
export function queryDoc(selector: string): Element | null {
  return document.querySelector(selector);
}

/** Minimal FindingView fixture (same shape as test/variance-counts-selector.test.ts). */
export function fv(
  id: string,
  severity: FindingView['severity'],
  extra: Partial<FindingView> = {},
): FindingView {
  return {
    id,
    severity,
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: [],
    quote: 'abc',
    quote_snippet: 'abc',
    detail: { explanation: `Explanation ${id}.`, facts: {}, interpretations: [] },
    confidence: 0.9,
    classLabel: 'Cross-reference',
    title: `Title ${id}`,
    ref: '§1',
    loc: 'Section 1',
    found: null,
    sensitive: [],
    order: 0,
    ...extra,
  } as unknown as FindingView;
}

export const changeFv = (id: string, extra: Partial<FindingView> = {}): FindingView =>
  fv(id, 'medium', {
    kind: 'change',
    issue_class: 'version_drift',
    detector_id: 'VAR-x',
    ...extra,
  });

export interface ViewOpts {
  changes?: FindingView[];
  filters?: Partial<Filters>;
  meta?: Record<string, VarianceMeta>;
  regressionMeta?: Record<string, VarianceMeta>;
  policy?: VarianceGatePolicy;
}

/** A ReviewView built from the same pure selectors as `useReviewView` (no store reads). */
export function makeView(
  errors: FindingView[],
  triage: Readonly<Record<string, Triage>> = {},
  opts: ViewOpts = {},
): ReviewView {
  const changes = opts.changes ?? [];
  const rows = buildRows(mergeFindings(errors, changes), null, triage);
  const { main, previous } = placement(rows);
  const visible = visibleRows(main, { ...DEFAULT_FILTERS, ...opts.filters });
  const result = { blocks: [{}] } as unknown as Parameters<typeof reviewGate>[1];
  const gate = reviewGate(rows, result, opts.policy);
  const counts = reviewCounts(rows, main, gate);
  const variance = opts.meta
    ? ({
        findings: changes,
        meta: opts.meta,
        gatePolicy: opts.policy,
        cosmeticGroups: [],
        summary: { cosmetic: 0 },
      } as unknown as ReviewView['variance'])
    : null;
  return {
    rows,
    main,
    previous,
    visible,
    chips: counts.chips,
    open: counts.open,
    counsel: counts.counsel,
    counts,
    hasChanges: changes.length > 0,
    regressionMeta: opts.regressionMeta ?? {},
    variance,
    variancePending: false,
    gate,
  };
}
