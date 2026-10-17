import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelResizer } from './PanelResizer';
import { installDomStubs, renderV2 } from './test-helpers';
import { usePanelWidth } from './use-panel-width';
import { FPW_KEY } from './width-math';

// Findings v2 A2-UI: separator attributes, keys, pointer drag, persistence (AC-5, P-8).
let mounted: { container: HTMLElement; unmount(): void } | null = null;

function Wired() {
  const w = usePanelWidth();
  return (
    <div className="work">
      <aside ref={w.ref}>
        <PanelResizer pct={w.pct} min={w.min} max={w.max} onChange={w.setPct} />
      </aside>
    </div>
  );
}

function handle(): HTMLElement {
  return mounted!.container.querySelector('[data-testid="panel-resizer"]')!;
}
function work(): HTMLElement {
  return mounted!.container.querySelector('.work')!;
}
function press(k: string, shiftKey = false) {
  act(() => {
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));
  });
}
function pointer(type: string, clientX: number) {
  act(() => {
    handle().dispatchEvent(new MouseEvent(type, { clientX, button: 0, bubbles: true }));
  });
}

beforeEach(() => {
  installDomStubs();
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

describe('findings-v2-panel-resizer', () => {
  it('should render the separator contract and the default width 50 at 1440 on .work', () => {
    mounted = renderV2(<Wired />);
    const h = handle();
    expect(h.getAttribute('role')).toBe('separator');
    expect(h.getAttribute('aria-orientation')).toBe('vertical');
    expect(h.getAttribute('aria-valuemin')).toBe('40');
    expect(h.getAttribute('aria-valuemax')).toBe('65');
    expect(h.getAttribute('aria-valuenow')).toBe('50');
    expect(h.getAttribute('aria-label')).toBe('Resize findings panel');
    expect(h.className).toBe('fv2-resizer');
    expect(work().style.getPropertyValue('--fpw')).toBe('50');
    expect(localStorage.getItem(FPW_KEY)).toBeNull();
  });

  it('should default to 55 below 1280 and read a stored value', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    mounted = renderV2(<Wired />);
    expect(handle().getAttribute('aria-valuenow')).toBe('55');
    mounted.unmount();
    localStorage.setItem(FPW_KEY, '62');
    mounted = renderV2(<Wired />);
    expect(handle().getAttribute('aria-valuenow')).toBe('62');
  });

  it('should step 2 with arrows, 10 with Shift, clamp, Home/End, and persist on each key', () => {
    mounted = renderV2(<Wired />);
    press('ArrowLeft');
    expect(handle().getAttribute('aria-valuenow')).toBe('52');
    expect(localStorage.getItem(FPW_KEY)).toBe('52');
    press('ArrowRight', true);
    expect(handle().getAttribute('aria-valuenow')).toBe('42');
    press('ArrowRight');
    press('ArrowRight');
    expect(handle().getAttribute('aria-valuenow')).toBe('40');
    press('End');
    expect(handle().getAttribute('aria-valuenow')).toBe('65');
    expect(work().style.getPropertyValue('--fpw')).toBe('65');
    press('Home');
    expect(localStorage.getItem(FPW_KEY)).toBe('40');
  });

  it('should follow the pointer live and persist only on pointer-up', () => {
    mounted = renderV2(<Wired />);
    vi.spyOn(work(), 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 1000,
      top: 0,
      height: 0,
      right: 1000,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    pointer('pointerdown', 500);
    pointer('pointermove', 400);
    expect(handle().getAttribute('aria-valuenow')).toBe('60');
    expect(localStorage.getItem(FPW_KEY)).toBeNull();
    pointer('pointermove', 100);
    expect(handle().getAttribute('aria-valuenow')).toBe('65');
    pointer('pointerup', 450);
    expect(handle().getAttribute('aria-valuenow')).toBe('55');
    expect(localStorage.getItem(FPW_KEY)).toBe('55');
    pointer('pointermove', 300);
    expect(handle().getAttribute('aria-valuenow')).toBe('55');
  });

  it('should report changes with the persist flag to a plain onChange', () => {
    const onChange = vi.fn();
    mounted = renderV2(
      <div className="work">
        <PanelResizer pct={50} min={40} max={65} onChange={onChange} />
      </div>,
    );
    press('ArrowLeft', true);
    press('Tab');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(60, true);
  });
});
