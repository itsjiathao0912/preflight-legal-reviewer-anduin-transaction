import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrollIntoViewVertically, useDocZoom, type DocZoom } from './use-doc-zoom';
import { DOCZOOM_KEY } from './zoom-math';

// AC-16: document zoom hook (jsdom; ResizeObserver stubbed, no layout).

type RoCb = (entries: unknown[]) => void;
let roCallbacks: RoCb[] = [];
class StubResizeObserver {
  private cb: RoCb;
  constructor(cb: RoCb) {
    this.cb = cb;
    roCallbacks.push(cb);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    roCallbacks = roCallbacks.filter((c) => c !== this.cb);
  }
}

let width = 764;
let latest: DocZoom | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;
const scrollSpy = vi.fn();

function Harness({ selectedId }: { selectedId: string | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const zoom = useDocZoom(ref, selectedId);
  latest = zoom;
  return (
    <div>
      <input data-testid="typing" />
      <div ref={ref} className="docscroll" data-dz={zoom.dataDz} style={zoom.style}>
        <mark data-testid="doc-highlight" data-finding-id="f1">
          a
        </mark>
        <mark data-testid="doc-highlight" data-finding-id="f2">
          b
        </mark>
      </div>
    </div>
  );
}

function mount(selectedId: string | null = 'f2') {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Harness selectedId={selectedId} />));
}

function unmount() {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
}

function key(k: string, opts: KeyboardEventInit = {}, target: EventTarget = window) {
  const e = new KeyboardEvent('keydown', {
    key: k,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

function resize(w: number) {
  width = w;
  act(() => roCallbacks.forEach((cb) => cb([])));
}

beforeEach(() => {
  window.localStorage.clear();
  roCallbacks = [];
  width = 764;
  scrollSpy.mockClear();
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains('docscroll') ? width : 0;
    },
  });
  Element.prototype.scrollIntoView = scrollSpy as unknown as Element['scrollIntoView'];
});

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  latest = null;
});

describe('findings-v2-use-doc-zoom', () => {
  it('defaults to fit width from the measured area and exposes style and data-dz', () => {
    mount();
    expect(latest!.state.mode).toBe('fit');
    expect(latest!.areaPx).toBe(764);
    expect(latest!.pct).toBe(100);
    expect(latest!.dataDz).toBe('100');
    const el = container!.querySelector('.docscroll') as HTMLElement;
    expect(el.getAttribute('data-dz')).toBe('100');
    expect(el.style.getPropertyValue('--dz')).toBe('1');
  });

  it('ignores width deltas below 2px and recomputes fit at 2px or more', () => {
    mount();
    resize(765);
    expect(latest!.areaPx).toBe(764);
    resize(1000);
    expect(latest!.areaPx).toBe(1000);
    expect(latest!.pct).toBe(134);
  });

  it('no-ops without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => mount()).not.toThrow();
    expect(latest!.pct).toBe(100);
  });

  it('persists and restores the zoom state', () => {
    mount();
    act(() => latest!.dispatch({ type: 'preset', pct: 150 }));
    expect(latest!.state).toEqual({ mode: 'manual', pct: 150 });
    expect(JSON.parse(window.localStorage.getItem(DOCZOOM_KEY)!)).toEqual({
      mode: 'manual',
      pct: 150,
    });
    unmount();
    mount();
    expect(latest!.state).toEqual({ mode: 'manual', pct: 150 });
    expect(latest!.pct).toBe(150);
  });

  it('falls back to fit on a corrupt saved value', () => {
    window.localStorage.setItem(DOCZOOM_KEY, '{bad');
    mount();
    expect(latest!.state.mode).toBe('fit');
  });

  it('handles Cmd/Ctrl = - 0 with preventDefault while mounted', () => {
    mount();
    const e1 = key('=');
    expect(e1.defaultPrevented).toBe(true);
    expect(latest!.pct).toBe(110);
    key('-', { ctrlKey: false, metaKey: true });
    expect(latest!.pct).toBe(100);
    key('-');
    expect(latest!.pct).toBe(90);
    key('0');
    expect(latest!.state.mode).toBe('fit');
    expect(latest!.pct).toBe(100);
  });

  it('ignores plain keys, alt combos and typing targets', () => {
    mount();
    const plain = key('=', { ctrlKey: false });
    expect(plain.defaultPrevented).toBe(false);
    key('=', { altKey: true });
    expect(latest!.pct).toBe(100);
    const input = container!.querySelector('[data-testid="typing"]')!;
    const typed = key('=', {}, input);
    expect(typed.defaultPrevented).toBe(false);
    expect(latest!.pct).toBe(100);
  });

  it('ignores keys while a dialog is open', () => {
    mount();
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    document.body.appendChild(dlg);
    const e = key('=');
    dlg.remove();
    expect(e.defaultPrevented).toBe(false);
    expect(latest!.pct).toBe(100);
  });

  it('does not intercept keys after unmount', () => {
    mount();
    unmount();
    const e = new KeyboardEvent('keydown', { key: '=', ctrlKey: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('re-centers the selected mark after a zoom change, not on mount', () => {
    mount('f2');
    expect(scrollSpy).not.toHaveBeenCalled();
    key('=');
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    expect(scrollSpy.mock.contexts[0]).toBe(container!.querySelector('mark[data-finding-id="f2"]'));
  });

  it('does not scroll when nothing is selected', () => {
    mount(null);
    key('=');
    expect(scrollSpy).not.toHaveBeenCalled();
  });
  it('does not re-center when only the area changes in fit mode (panel drag, window resize) (R6)', () => {
    mount('f2');
    resize(1000);
    resize(600);
    expect(scrollSpy).not.toHaveBeenCalled();
    key('=');
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    resize(900);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('re-centers after the fit preset when the fit width differs from the manual zoom (R6)', () => {
    mount('f2');
    key('=');
    scrollSpy.mockClear();
    act(() => latest!.dispatch({ type: 'fit' }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('scrollIntoViewVertically keeps the document area horizontal position', () => {
    const area = document.createElement('div');
    area.className = 'docscroll';
    const mark = document.createElement('mark');
    area.appendChild(mark);
    document.body.appendChild(area);
    area.scrollLeft = 0;
    scrollSpy.mockImplementationOnce(() => {
      area.scrollLeft = 85;
    });
    scrollIntoViewVertically(mark, 'center');
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    expect(area.scrollLeft).toBe(0);
    area.remove();
  });
});
