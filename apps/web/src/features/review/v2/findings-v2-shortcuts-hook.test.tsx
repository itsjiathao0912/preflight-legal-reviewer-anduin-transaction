import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRows } from '../model';
import { fv, installDomStubs, renderV2 } from './test-helpers';
import type { Control } from './types';
import { useShortcuts, type ShortcutArgs } from './use-shortcuts';

// Findings v2 A2-UI: J/K/C/X hook (AC-15).
const ROWS = buildRows([fv('a', 'high'), fv('b', 'high'), fv('c', 'high')], null, {});

let mounted: { unmount(): void } | null = null;
let rafSpy: ReturnType<typeof vi.spyOn> | null = null;

function Harness(props: ShortcutArgs) {
  useShortcuts(props);
  return (
    <ul>
      {props.flat.map((r) => (
        <li key={r.f.id}>
          <button type="button" data-testid="finding-row" data-finding-id={r.f.id}>
            {r.f.id}
          </button>
        </li>
      ))}
    </ul>
  );
}

function setup(over: Partial<ShortcutArgs> = {}) {
  const args: ShortcutArgs = {
    flat: ROWS,
    selectedId: null,
    select: vi.fn(),
    onControl: vi.fn(),
    barEnabled: () => true,
    ...over,
  };
  mounted = renderV2(<Harness {...args} />);
  return args;
}

function key(k: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

beforeEach(() => {
  installDomStubs();
  rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  rafSpy?.mockRestore();
  document.body.textContent = '';
});

describe('findings-v2-shortcuts-hook', () => {
  it('should walk J forward from nothing to the first row and focus it', () => {
    const a = setup();
    const e = key('j');
    expect(a.select).toHaveBeenCalledWith('a');
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute('data-finding-id')).toBe('a');
  });

  it('should move J/K by one and stop at the ends (no wrap)', () => {
    const mid = setup({ selectedId: 'b' });
    key('j');
    key('k');
    expect(mid.select).toHaveBeenNthCalledWith(1, 'c');
    expect(mid.select).toHaveBeenNthCalledWith(2, 'a');
    mounted!.unmount();
    const last = setup({ selectedId: 'c' });
    key('J');
    expect(last.select).not.toHaveBeenCalled();
    mounted!.unmount();
    const first = setup({ selectedId: 'a' });
    key('k');
    expect(first.select).not.toHaveBeenCalled();
  });

  it('should dispatch C and X only when the bar control is enabled', () => {
    const enabled = new Set<Control>(['ask-counsel']);
    const a = setup({ selectedId: 'a', barEnabled: (c) => enabled.has(c) });
    key('c');
    key('x');
    expect(a.onControl).toHaveBeenCalledTimes(1);
    expect(a.onControl).toHaveBeenCalledWith('ask-counsel');
  });

  it('should ignore keys while typing, with modifiers, on repeat C/X or with a dialog open', () => {
    const a = setup({ selectedId: 'a' });
    const input = document.createElement('input');
    document.body.appendChild(input);
    key('j', {}, input);
    key('j', { metaKey: true });
    key('c', { repeat: true });
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    document.body.appendChild(dlg);
    key('j');
    key('x');
    dlg.remove();
    expect(a.select).not.toHaveBeenCalled();
    expect(a.onControl).not.toHaveBeenCalled();
    key('j', { repeat: true });
    expect(a.select).toHaveBeenCalledWith('b');
  });

  it('should remove the listener on unmount', () => {
    const a = setup();
    mounted!.unmount();
    mounted = null;
    key('j');
    expect(a.select).not.toHaveBeenCalled();
  });
});
