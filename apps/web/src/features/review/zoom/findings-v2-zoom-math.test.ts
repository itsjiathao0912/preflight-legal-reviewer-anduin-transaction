import { describe, expect, it } from 'vitest';
import {
  DOCZOOM_KEY,
  PRESETS,
  effectivePct,
  fitWidth,
  parseZoom,
  zoomKeyAction,
  zoomReducer,
} from './zoom-math';

// AC-16: document zoom math.
const mod = { ctrlKey: false, metaKey: false, altKey: false };

describe('findings-v2-zoom-math', () => {
  it('constants', () => {
    expect(DOCZOOM_KEY).toBe('ui:v1:doczoom');
    expect(PRESETS).toEqual([75, 90, 100, 125, 150]);
  });
  it('fitWidth clamps at the edges', () => {
    expect(fitWidth(0)).toBe(90);
    expect(fitWidth(764)).toBe(100);
    expect(fitWidth(1900)).toBe(175);
    expect(fitWidth(4000)).toBe(175);
    expect(fitWidth(1000)).toBe(134);
  });
  it('effectivePct', () => {
    expect(effectivePct({ mode: 'fit', pct: 150 }, 764)).toBe(100);
    expect(effectivePct({ mode: 'manual', pct: 150 }, 764)).toBe(150);
  });
  it('steps in and out from manual and fit', () => {
    expect(zoomReducer({ mode: 'manual', pct: 100 }, { type: 'in' }, 0)).toEqual({
      mode: 'manual',
      pct: 110,
    });
    expect(zoomReducer({ mode: 'manual', pct: 100 }, { type: 'out' }, 0)).toEqual({
      mode: 'manual',
      pct: 90,
    });
    // fit at 1000px = 134 -> in 140, out 130
    expect(zoomReducer({ mode: 'fit', pct: 100 }, { type: 'in' }, 1000)).toEqual({
      mode: 'manual',
      pct: 140,
    });
    expect(zoomReducer({ mode: 'fit', pct: 100 }, { type: 'out' }, 1000)).toEqual({
      mode: 'manual',
      pct: 130,
    });
    expect(zoomReducer({ mode: 'manual', pct: 200 }, { type: 'in' }, 0).pct).toBe(200);
    expect(zoomReducer({ mode: 'manual', pct: 75 }, { type: 'out' }, 0).pct).toBe(75);
    expect(zoomReducer({ mode: 'manual', pct: 78 }, { type: 'out' }, 0).pct).toBe(75);
  });
  it('preset clamps and fit keeps the manual pct', () => {
    expect(zoomReducer({ mode: 'fit', pct: 100 }, { type: 'preset', pct: 125 }, 0)).toEqual({
      mode: 'manual',
      pct: 125,
    });
    expect(zoomReducer({ mode: 'fit', pct: 100 }, { type: 'preset', pct: 10 }, 0).pct).toBe(75);
    expect(zoomReducer({ mode: 'fit', pct: 100 }, { type: 'preset', pct: 500 }, 0).pct).toBe(200);
    expect(zoomReducer({ mode: 'manual', pct: 125 }, { type: 'fit' }, 0)).toEqual({
      mode: 'fit',
      pct: 125,
    });
  });
  it('parseZoom rejects junk', () => {
    const fb = { mode: 'fit', pct: 100 };
    expect(parseZoom(null)).toEqual(fb);
    expect(parseZoom('x')).toEqual(fb);
    expect(parseZoom({ mode: 'zoomy', pct: 120 })).toEqual(fb);
    expect(parseZoom({ mode: 'manual', pct: 'x' })).toEqual(fb);
    expect(parseZoom({ mode: 'manual', pct: 300 })).toEqual({ mode: 'manual', pct: 200 });
    expect(parseZoom({ mode: 'manual', pct: 111.6 })).toEqual({ mode: 'manual', pct: 112 });
    expect(parseZoom({ mode: 'fit', pct: 125 })).toEqual({ mode: 'fit', pct: 125 });
  });
  it('key mapping', () => {
    expect(zoomKeyAction({ ...mod, key: '=', ctrlKey: true })).toEqual({ type: 'in' });
    expect(zoomKeyAction({ ...mod, key: '+', metaKey: true })).toEqual({ type: 'in' });
    expect(zoomKeyAction({ ...mod, key: '-', ctrlKey: true })).toEqual({ type: 'out' });
    expect(zoomKeyAction({ ...mod, key: '_', metaKey: true })).toEqual({ type: 'out' });
    expect(zoomKeyAction({ ...mod, key: '0', ctrlKey: true })).toEqual({ type: 'fit' });
    expect(zoomKeyAction({ ...mod, key: '=' })).toBeNull();
    expect(zoomKeyAction({ ...mod, key: '=', ctrlKey: true, altKey: true })).toBeNull();
    expect(zoomKeyAction({ ...mod, key: 'a', ctrlKey: true })).toBeNull();
  });
});
