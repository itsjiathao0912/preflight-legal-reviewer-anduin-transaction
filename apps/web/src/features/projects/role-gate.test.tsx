import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReview, type DocMeta } from '../../state/review';
import { canMarkReady, MARK_READY_REASON, ROLES, useProjects } from '../../state/projects';
import { setCounselMode } from '../../state/share-role';
import * as h from '../review/v2/test-helpers';
import { CounselScreen } from '../counsel/CounselScreen';
import { useShare } from '../counsel/counsel-share';

// Projects v1 AC4: only the Approver can press Mark ready to digitize; others see it disabled
// with a short reason (advisory, UI-only). The gate is green here, so only the role decides.
vi.mock('../review/use-review-view', () => ({
  useReviewView: () => ({
    rows: [],
    gate: { status: 'ready', reasons: [] },
    counts: { owners: { counsel: 0, gp: 0, fund_admin: 0 } },
    hasChanges: false,
    regressionMeta: {},
  }),
}));
vi.mock('../metrics/MetricsPanel', () => ({ MetricsPanel: () => null }));
vi.mock('../package/package-view', () => ({ usePackageView: () => null }));
vi.mock('../counsel/GpRequestGroup', () => ({
  GpRequestGroup: () => null,
  useGpRequests: () => null,
  gpRequestFacts: (n: number) => ({ owner: 'gp', sev: 'fix', waiting: n > 0 }),
}));

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
const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
let mounted: { unmount(): void } | null = null;

beforeEach(() => {
  h.installDomStubs();
  document.body.replaceChildren();
  setCounselMode(false);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('no network'))),
  );
  useShare.setState({ role: 'analyst', pendingToken: null, readyAt: null, sheet: null });
  useProjects.setState({ viewAs: 'approver' });
  useReview.setState({
    doc: DOC,
    phase: 'ready',
    result: { blocks: [{ id: 'b0', text: 'abc' }], findings: [] } as never,
    triage: {},
    memory: null,
    selectedId: null,
  });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

describe('role-gate', () => {
  it('should allow Mark ready only for the Approver role', () => {
    expect(ROLES.filter(canMarkReady)).toEqual(['approver']);
  });

  it('should enable Mark ready to digitize for the Approver (default role)', () => {
    mounted = h.renderV2(<CounselScreen />);
    expect((q('counsel-mark-ready') as HTMLButtonElement).disabled).toBe(false);
    expect(q('counsel-ready-role-reason')).toBeNull();
  });

  it.each(['counsel', 'analyst', 'advisor'] as const)(
    'should disable Mark ready with a short reason when viewing as %s',
    (role) => {
      useProjects.setState({ viewAs: role });
      mounted = h.renderV2(<CounselScreen />);
      const btn = q('counsel-mark-ready') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.title).toBe(MARK_READY_REASON);
      expect(q('counsel-ready-role-reason')?.textContent).toBe(MARK_READY_REASON);
    },
  );

  it('should re-enable the button when switching back to Approver', () => {
    useProjects.setState({ viewAs: 'counsel' });
    mounted = h.renderV2(<CounselScreen />);
    expect((q('counsel-mark-ready') as HTMLButtonElement).disabled).toBe(true);
    act(() => useProjects.getState().setViewAs('approver'));
    expect((q('counsel-mark-ready') as HTMLButtonElement).disabled).toBe(false);
  });
});
