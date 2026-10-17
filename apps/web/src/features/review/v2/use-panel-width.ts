import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { safeGet, safeSet } from '../../../state/storage';
import { clampPct, FPW_KEY, FPW_MAX, FPW_MIN, readPct } from './width-math';

function viewport(): number {
  return typeof window === 'undefined' ? 1280 : window.innerWidth;
}

/**
 * Findings panel width in percent of `.work` (D4, P-2). Sets `--fpw` on the closest `.work`;
 * persists `ui:v1:fpw` only when asked (pointer-up, key press).
 */
export function usePanelWidth(): {
  pct: number;
  setPct(n: number, persist?: boolean): void;
  ref: RefObject<HTMLElement | null>;
  min: number;
  max: number;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [pct, setState] = useState(() => readPct(safeGet(FPW_KEY), viewport()));
  useLayoutEffect(() => {
    const work = ref.current?.closest<HTMLElement>('.work');
    work?.style.setProperty('--fpw', String(pct));
  }, [pct]);
  const setPct = useCallback((n: number, persist = false) => {
    const v = clampPct(n);
    setState(v);
    if (persist) safeSet(FPW_KEY, String(v));
  }, []);
  return { pct, setPct, ref, min: FPW_MIN, max: FPW_MAX };
}
