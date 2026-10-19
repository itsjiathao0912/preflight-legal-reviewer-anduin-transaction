import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCounselMode } from '../../state/share-role';
import { useShare } from '../counsel/counsel-share';
import { FindingsScreen } from './FindingsScreen';
import * as h from './v2/test-helpers';

// Findings header carries the same "Share with counsel" action as Questions, analyst only.
vi.mock('./use-review-view', () => ({
  useReviewView: () => ({
    rows: [],
    gate: { status: 'ready', reasons: [] },
    counts: { owners: { counsel: 0, gp: 0, fund_admin: 0 } },
    hasChanges: false,
    regressionMeta: {},
  }),
}));
vi.mock('./v2', () => ({ FindingsPanelV2: () => null }));
vi.mock('./components/DocPane', () => ({ DocPane: () => null }));
vi.mock('./components/Banners', () => ({ Banners: () => null }));
vi.mock('../variance/BaselineControl', () => ({ BaselineControl: () => null }));
vi.mock('../processing/StageStatus', () => ({ StageStatus: () => null }));
vi.mock('../gate/CoverageLine', () => ({ CoverageLine: () => null }));

let mounted: { unmount(): void } | null = null;
const q = (id: string) => document.body.querySelector(`[data-testid="${id}"]`);

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setCounselMode(false);
  useShare.setState({ role: 'analyst' } as never);
});

describe('Findings header share action', () => {
  it('should render a Share button for the analyst', () => {
    mounted = h.renderV2(<FindingsScreen />);
    expect(q('findings-share')?.textContent).toContain('Share with counsel');
  });

  it('should render no Share button in counsel mode', () => {
    setCounselMode(true);
    useShare.setState({ role: 'counsel' } as never);
    mounted = h.renderV2(<FindingsScreen />);
    expect(q('findings-share')).toBeNull();
  });
});
