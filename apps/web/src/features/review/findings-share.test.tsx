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
  useShare.setState({ role: 'analyst', sheet: null } as never);
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

  it('should show joined counsel as avatars with names for the analyst', () => {
    const now = Date.now();
    useShare.setState({
      sheet: {
        participants: [
          { name: 'Rita Moreno', joined_at: now - 5 * 60_000 },
          { name: 'Sam', joined_at: now - 3_600_000 },
          { name: 'Ann Lee', joined_at: now - 7_200_000 },
          { name: 'Bo Diaz', joined_at: now - 9_000_000 },
        ],
      },
    } as never);
    mounted = h.renderV2(<FindingsScreen />);
    const people = document.body.querySelectorAll('[data-testid="counsel-participant"]');
    expect(people).toHaveLength(3);
    expect(people[0]?.textContent).toBe('RMRita Moreno');
    expect(people[0]?.getAttribute('title')).toBe('Rita Moreno joined 5 min ago');
    expect(q('counsel-participants-more')?.textContent).toBe('+1');
  });

  it('should hide joined counsel in counsel mode', () => {
    setCounselMode(true);
    useShare.setState({
      role: 'counsel',
      sheet: { participants: [{ name: 'Rita', joined_at: Date.now() }] },
    } as never);
    mounted = h.renderV2(<FindingsScreen />);
    expect(q('counsel-participants')).toBeNull();
  });
});
