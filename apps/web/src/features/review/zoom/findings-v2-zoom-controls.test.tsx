import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocZoomControls } from './DocZoomControls';
import type { ZoomAction } from './zoom-math';

// AC-16: zoom control ids, aria names, aria-pressed on Fit width, preset menu.

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(pct: number, mode: 'fit' | 'manual', dispatch: (a: ZoomAction) => void) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<DocZoomControls pct={pct} mode={mode} dispatch={dispatch} />));
}

const q = (id: string) => container!.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('findings-v2-zoom-controls', () => {
  it('renders the four controls with test ids and classes', () => {
    mount(100, 'fit', vi.fn());
    const group = q('doc-zoom-controls')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Document zoom');
    expect(group.classList.contains('fv2-zoom')).toBe(true);
    for (const id of ['zoom-out', 'zoom-menu', 'zoom-in', 'zoom-fit']) {
      expect(q(id)?.classList.contains('fv2-zoom-btn')).toBe(true);
    }
  });

  it('aria names contain the visible text', () => {
    mount(125, 'manual', vi.fn());
    expect(q('zoom-out')!.getAttribute('aria-label')).toBe('Zoom out');
    expect(q('zoom-in')!.getAttribute('aria-label')).toBe('Zoom in');
    expect(q('zoom-menu')!.textContent).toContain('125%');
    expect(q('zoom-menu')!.getAttribute('aria-label')).toContain('125%');
    expect(q('zoom-fit')!.textContent).toBe('Fit width');
  });

  it('marks Fit width aria-pressed only in fit mode', () => {
    mount(100, 'fit', vi.fn());
    expect(q('zoom-fit')!.getAttribute('aria-pressed')).toBe('true');
    act(() => root!.render(<DocZoomControls pct={110} mode="manual" dispatch={vi.fn()} />));
    expect(q('zoom-fit')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('dispatches in, out and fit', () => {
    const d = vi.fn();
    mount(100, 'manual', d);
    click(q('zoom-in')!);
    click(q('zoom-out')!);
    click(q('zoom-fit')!);
    expect(d.mock.calls.map((c) => c[0])).toEqual([
      { type: 'in' },
      { type: 'out' },
      { type: 'fit' },
    ]);
  });

  it('opens the preset menu, lists presets and dispatches a preset', () => {
    const d = vi.fn();
    mount(100, 'manual', d);
    const menuBtn = q('zoom-menu')!;
    expect(menuBtn.getAttribute('aria-expanded')).toBe('false');
    expect(container!.querySelector('[role="menu"]')).toBeNull();
    click(menuBtn);
    expect(menuBtn.getAttribute('aria-expanded')).toBe('true');
    const items = [...container!.querySelectorAll('[role="menuitemradio"]')];
    expect(items.map((i) => i.textContent)).toEqual(['75%', '90%', '100%', '125%', '150%']);
    expect(q('zoom-preset-100')!.getAttribute('aria-checked')).toBe('true');
    click(q('zoom-preset-150')!);
    expect(d).toHaveBeenCalledWith({ type: 'preset', pct: 150 });
    expect(container!.querySelector('[role="menu"]')).toBeNull();
  });

  it('closes the menu on Escape', () => {
    mount(100, 'fit', vi.fn());
    click(q('zoom-menu')!);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container!.querySelector('[role="menu"]')).toBeNull();
  });
});
