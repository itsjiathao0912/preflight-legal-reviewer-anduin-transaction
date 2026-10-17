import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackageGateReason } from '@aduin/core';
import type { PackageView } from '../package/contract';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useReview } from '../../state/review';
import { GateButton } from '../../shell/GateButton';
import { CoverageLine } from './CoverageLine';
import { PackageGateReasons } from './PackageGateReasons';
import { useGatePopover } from './gate-store';

// Intake Phase 3 track 3b: package gate reasons merged into the gate pill, coverage line.
const state = vi.hoisted(() => ({
  view: null as unknown,
  gate: { status: 'ready', reasons: [] as unknown[], unreadable: false } as {
    status: 'ready' | 'blocked';
    reasons: unknown[];
    unreadable: boolean;
  },
}));

vi.mock('../package/package-view', () => ({ usePackageView: () => state.view }));
vi.mock('../review/use-review-view', () => ({
  useReviewView: () => ({ gate: state.gate, rows: [] }),
}));
vi.mock('./GateReasons', () => ({
  GateReasons: ({ reasons }: { reasons: unknown[] }) => (
    <ul data-testid="core-reasons" data-n={reasons.length} />
  ),
}));

const BLOCK: PackageGateReason = {
  level: 'block',
  docType: 'sub_agreement',
  text: 'No subscription agreement in the package.',
};
const WARN: PackageGateReason = {
  level: 'warn',
  docType: 'lpa',
  text: 'The LPA is referenced but not in the package.',
};

function pkg(gateReasons: PackageGateReason[]): PackageView {
  return {
    packageId: 'p1',
    firmId: null,
    firmName: '',
    fund: 'Fund III',
    version: 'v1',
    documents: [],
    references: [],
    terms: [],
    coverage: [],
    coverageLine: 'Coverage: partial · external references missing LPA',
    coverageStatus: 'partial',
    gateReasons,
    requests: [],
    baselines: [],
    refreshing: false,
  };
}

let root: Root | null = null;
function render(ui: ReactElement) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root?.render(ui));
}

const q = (id: string) => document.body.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => document.body.querySelectorAll(`[data-testid="${id}"]`);

beforeEach(() => {
  useReview.setState({ result: {} as never });
  state.view = null;
  state.gate = { status: 'ready', reasons: [], unreadable: false };
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  act(() => useGatePopover.setState({ open: false }));
  document.body.innerHTML = '';
});

describe('package-gate-ui', () => {
  it('renders nothing for a null view', () => {
    render(
      <>
        <CoverageLine placement="header" />
        <PackageGateReasons reasons={[]} />
      </>,
    );
    expect(q('findings-coverage-line')).toBeNull();
    expect(q('package-gate-reason')).toBeNull();
    expect(q('package-gate-warning')).toBeNull();
  });

  it('coverage line text equals the view string, testid by placement', () => {
    state.view = pkg([]);
    render(
      <>
        <CoverageLine placement="header" />
        <CoverageLine placement="popover" />
      </>,
    );
    const h = q('findings-coverage-line');
    expect(h?.textContent).toBe(pkg([]).coverageLine);
    expect(h?.getAttribute('data-status')).toBe('partial');
    expect(q('gate-coverage-line')?.textContent).toBe(pkg([]).coverageLine);
  });

  it('renders block reasons and warnings separately', () => {
    render(<PackageGateReasons reasons={[BLOCK, WARN]} />);
    expect(q('package-gate-reason')?.getAttribute('data-level')).toBe('block');
    expect(q('package-gate-reason')?.textContent).toBe(BLOCK.text);
    expect(q('package-gate-warning')?.getAttribute('data-level')).toBe('warn');
    expect(document.body.textContent).toContain('Warnings (they do not block digitization)');
  });

  it('missing sub agreement blocks with the reason and a count one higher', () => {
    state.gate = { status: 'blocked', reasons: [{}], unreadable: false };
    state.view = pkg([BLOCK]);
    act(() => useGatePopover.setState({ open: true }));
    render(<GateButton />);
    const btn = q('gate-button');
    expect(btn?.getAttribute('data-gate-state')).toBe('blocked');
    expect(btn?.textContent).toContain('Blocked · 2');
    expect(btn?.querySelector('.gn')?.textContent).toBe('2');
    expect(q('package-gate-reason')?.textContent).toBe(BLOCK.text);
    expect(q('gate-coverage-line')).not.toBeNull();
    expect(q('core-reasons')?.getAttribute('data-n')).toBe('1');
  });

  it('a ready core gate becomes Blocked · 1 for a missing sub agreement', () => {
    state.view = pkg([BLOCK]);
    render(<GateButton />);
    expect(q('gate-button')?.textContent).toContain('Blocked · 1');
  });

  it('an LPA warning only keeps the core label', () => {
    state.view = pkg([WARN]);
    act(() => useGatePopover.setState({ open: true }));
    render(<GateButton />);
    expect(q('gate-button')?.getAttribute('data-gate-state')).toBe('ready');
    expect(q('gate-button')?.textContent).toContain('Ready to digitize');
    expect(q('package-gate-warning')).not.toBeNull();
    expect(q('package-gate-reason')).toBeNull();
    expect(qa('gate-coverage-line').length).toBe(1);
  });

  it('a no-text document stays unreadable even with a package block reason', () => {
    state.gate = { status: 'ready', reasons: [], unreadable: true };
    state.view = pkg([BLOCK]);
    render(<GateButton />);
    expect(q('gate-button')?.getAttribute('data-gate-state')).toBe('unreadable');
    expect(q('gate-button')?.textContent).toContain('Not ready · no text');
  });
});
