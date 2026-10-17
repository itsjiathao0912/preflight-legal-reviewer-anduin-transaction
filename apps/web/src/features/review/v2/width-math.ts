export const FPW_KEY = 'ui:v1:fpw';
export const FPW_MIN = 40;
export const FPW_MAX = 65;
/** P-8: mockup parity (Arrow 2, Shift+Arrow 10). */
export const FPW_STEP = 2;
export const FPW_STEP_BIG = 10;

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return FPW_MIN;
  return Math.min(FPW_MAX, Math.max(FPW_MIN, Math.round(n)));
}

export function defaultPct(viewportPx: number): number {
  return viewportPx >= 1280 ? 50 : 55;
}

/** Stored value must be an integer string 40..65; anything else gives the default. */
export function readPct(raw: string | null, viewportPx: number): number {
  if (raw === null || !/^\d+$/.test(raw.trim())) return defaultPct(viewportPx);
  const n = Number(raw.trim());
  return n >= FPW_MIN && n <= FPW_MAX ? n : defaultPct(viewportPx);
}

/** The panel is the RIGHT column: its width is the distance from the pointer to the right edge. */
export function pctFromPointer(clientX: number, work: { left: number; width: number }): number {
  if (!(work.width > 0)) return FPW_MIN;
  return clampPct(((work.left + work.width - clientX) / work.width) * 100);
}

export function pctFromKey(pct: number, key: string, shift?: boolean): number | null {
  const step = shift ? FPW_STEP_BIG : FPW_STEP;
  switch (key) {
    case 'ArrowLeft':
      return clampPct(pct + step);
    case 'ArrowRight':
      return clampPct(pct - step);
    case 'Home':
      return FPW_MIN;
    case 'End':
      return FPW_MAX;
    default:
      return null;
  }
}
