export const DOCZOOM_KEY = 'ui:v1:doczoom';
export const PAGE_PX = 700;
/** 2 x 32px gutter. */
export const GUTTER_PX = 64;
/** Manual range shares the fit floor so - from a 60% fit is a no-op and + goes to 70 (D15 amendment). */
export const ZOOM_MIN = 60;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;
export const FIT_MIN = 60;
export const FIT_MAX = 175;
export const PRESETS: readonly number[] = Object.freeze([75, 90, 100, 125, 150]);

/** `pct` is meaningful only in manual mode. */
export interface ZoomState {
  mode: 'fit' | 'manual';
  pct: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function fitWidth(areaPx: number): number {
  const a = Number.isFinite(areaPx) ? areaPx : 0;
  return clamp(Math.round(((a - GUTTER_PX) / PAGE_PX) * 100), FIT_MIN, FIT_MAX);
}

export function effectivePct(s: ZoomState, areaPx: number): number {
  return s.mode === 'fit' ? fitWidth(areaPx) : s.pct;
}

export type ZoomAction =
  { type: 'in' } | { type: 'out' } | { type: 'preset'; pct: number } | { type: 'fit' };

export function zoomReducer(s: ZoomState, a: ZoomAction, areaPx: number): ZoomState {
  const eff = effectivePct(s, areaPx);
  switch (a.type) {
    case 'in':
      return {
        mode: 'manual',
        pct: Math.min(ZOOM_MAX, (Math.floor(eff / ZOOM_STEP) + 1) * ZOOM_STEP),
      };
    case 'out':
      return {
        mode: 'manual',
        pct: Math.max(ZOOM_MIN, (Math.ceil(eff / ZOOM_STEP) - 1) * ZOOM_STEP),
      };
    case 'preset':
      return {
        mode: 'manual',
        pct: clamp(Math.round(Number.isFinite(a.pct) ? a.pct : 100), ZOOM_MIN, ZOOM_MAX),
      };
    case 'fit':
      return { mode: 'fit', pct: s.pct };
  }
}

export function parseZoom(raw: unknown): ZoomState {
  const fallback: ZoomState = { mode: 'fit', pct: 100 };
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as { mode?: unknown; pct?: unknown };
  if (typeof o.pct !== 'number' || !Number.isFinite(o.pct)) return fallback;
  const pct = clamp(Math.round(o.pct), ZOOM_MIN, ZOOM_MAX);
  if (o.mode === 'manual') return { mode: 'manual', pct };
  if (o.mode === 'fit') return { mode: 'fit', pct };
  return fallback;
}

export function zoomKeyAction(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): ZoomAction | null {
  if (e.altKey || !(e.ctrlKey || e.metaKey)) return null;
  switch (e.key) {
    case '=':
    case '+':
      return { type: 'in' };
    case '-':
    case '_':
      return { type: 'out' };
    case '0':
      return { type: 'fit' };
    default:
      return null;
  }
}
