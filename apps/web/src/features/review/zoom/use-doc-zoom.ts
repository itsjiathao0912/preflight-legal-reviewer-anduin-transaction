import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { safeGetJson, safeSet } from '../../../state/storage';
import { isEditableTarget } from '../v2/shortcut-guard';
import {
  DOCZOOM_KEY,
  effectivePct,
  parseZoom,
  zoomKeyAction,
  zoomReducer,
  type ZoomAction,
  type ZoomState,
} from './zoom-math';

/** Width changes below this many pixels are ignored (avoids resize feedback loops). */
const MIN_DELTA_PX = 2;

export interface DocZoom {
  state: ZoomState;
  pct: number;
  areaPx: number;
  dispatch(a: ZoomAction): void;
  style: CSSProperties;
  dataDz: string;
}

function findMark(root: ParentNode, id: string): Element | null {
  for (const el of root.querySelectorAll('mark[data-testid="doc-highlight"]')) {
    if ((el as HTMLElement).dataset.findingId === id) return el;
  }
  return null;
}

/** D15 document zoom: fit width by default, manual 60-200 (fit 60-175), Cmd/Ctrl = - 0, saved per viewer. */
export function useDocZoom(
  scrollRef: RefObject<HTMLElement | null>,
  selectedId: string | null,
): DocZoom {
  const [state, setState] = useState<ZoomState>(() => parseZoom(safeGetJson(DOCZOOM_KEY)));
  const [areaPx, setAreaPx] = useState<number>(() => scrollRef.current?.clientWidth ?? 0);
  const areaRef = useRef(areaPx);
  areaRef.current = areaPx;

  // R6: the state object produced by the last user zoom action (buttons, presets, keys)
  const userState = useRef<ZoomState | null>(null);
  const dispatch = useCallback((a: ZoomAction) => {
    setState((s) => {
      const next = zoomReducer(s, a, areaRef.current);
      safeSet(DOCZOOM_KEY, JSON.stringify(next));
      userState.current = next;
      return next;
    });
  }, []);

  // Track the document area width; no-op where ResizeObserver does not exist.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (Math.abs(w - areaRef.current) >= MIN_DELTA_PX) setAreaPx(w);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  // Keyboard zoom only while mounted; never hijack typing or an open dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = zoomKeyAction(e);
      if (!action) return;
      if (isEditableTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const pct = effectivePct(state, areaPx);

  // R6: after a user zoom action keep the selected finding in view; area-driven fit recomputes
  // (panel drag, window resize, the first measurement) never move the scroll position.
  const prevPct = useRef(pct);
  const prevState = useRef(state);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  useEffect(() => {
    const user = state !== prevState.current && userState.current === state;
    prevState.current = state;
    if (user) userState.current = null;
    if (prevPct.current === pct) return;
    prevPct.current = pct;
    if (!user) return;
    const id = selectedRef.current;
    const root = scrollRef.current;
    if (!id || !root) return;
    const mark = findMark(root, id);
    if (mark) scrollIntoViewVertically(mark, 'center');
  }, [pct, state, scrollRef]);

  return {
    state,
    pct,
    areaPx,
    dispatch,
    style: { '--dz': pct / 100 } as CSSProperties,
    dataDz: String(pct),
  };
}

/**
 * Scrolls `el` into view vertically only: the document area keeps its horizontal position, so a
 * page wider than the reading area is never shifted off its left edge by a row click or a jump.
 */
export function scrollIntoViewVertically(el: Element, block: ScrollLogicalPosition): void {
  if (typeof el.scrollIntoView !== 'function') return;
  const area = el.closest('.docscroll');
  const left = area ? area.scrollLeft : 0;
  el.scrollIntoView({ block, inline: 'nearest' });
  if (area && area.scrollLeft !== left) area.scrollLeft = left;
}
