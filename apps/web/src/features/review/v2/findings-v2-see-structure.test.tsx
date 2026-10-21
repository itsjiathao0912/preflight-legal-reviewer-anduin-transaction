import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useShell } from '../../../state/shell';
import { SeeInStructure } from './SeeInStructure';
import { fv, renderV2 } from './test-helpers';

const TERM = fv('t1', 'high', {
  issue_class: 'defined_term_issue',
  detail: { explanation: 'x', facts: { used_term: 'Units' }, interpretations: [] },
});
const XREF = fv('x1', 'high');

afterEach(() =>
  useShell.setState({ route: 'findings', structureFocus: null, findingsView: 'issues' }),
);

describe('SeeInStructure', () => {
  it('shows for a term finding and opens the Sources view with the term focused', () => {
    const m = renderV2(
      <dl>
        <SeeInStructure f={TERM} />
      </dl>,
    );
    const btn = m.container.querySelector<HTMLButtonElement>(
      '[data-testid="finding-see-structure"]',
    );
    expect(btn).not.toBeNull();
    act(() => btn!.click());
    expect(useShell.getState().structureFocus).toEqual({ tab: 'terms', key: 'units' });
    expect(useShell.getState().route).toBe('findings');
    expect(useShell.getState().findingsView).toBe('sources');
    expect(btn!.textContent).toBe('See in Sources →');
    m.unmount();
  });

  it('is absent for a non-term finding', () => {
    const m = renderV2(
      <dl>
        <SeeInStructure f={XREF} />
      </dl>,
    );
    expect(m.container.querySelector('[data-testid="finding-see-structure"]')).toBeNull();
    m.unmount();
  });

  it('clearStructureFocus resets to null', () => {
    useShell.getState().setStructureFocus({ tab: 'terms' });
    useShell.getState().clearStructureFocus();
    expect(useShell.getState().structureFocus).toBeNull();
  });
});
