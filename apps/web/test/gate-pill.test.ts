// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { gatePillView } from '../src/features/gate/gate-pill';

describe('gate pill view', () => {
  it('is neutral with no document open, even when the empty gate computes ready', () => {
    const v = gatePillView(false, { status: 'ready', reasons: [] });
    expect(v.state).toBe('none');
    expect(v.label).toBe('No document');
    expect(v.className).toBe('gate none');
    expect(v.className).not.toContain('ready');
    expect(v.icon).not.toBe('unlock');
  });
  it('shows Ready only when a document is open and nothing blocks', () => {
    const v = gatePillView(true, { status: 'ready', reasons: [] });
    expect(v).toMatchObject({
      state: 'ready',
      label: 'Ready to digitize',
      className: 'gate ready',
    });
  });
  it('shows Blocked with the reason count', () => {
    const v = gatePillView(true, { status: 'blocked', reasons: [1, 2] });
    expect(v).toMatchObject({ state: 'blocked', label: 'Blocked · 2', className: 'gate' });
  });
});
