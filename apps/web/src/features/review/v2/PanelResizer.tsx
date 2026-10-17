import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { pctFromKey, pctFromPointer } from './width-math';

/**
 * 8px handle on the panel's left edge (P-2). Pointer drag updates live and persists on pointer-up;
 * arrow keys (2, Shift 10), Home and End persist on each key press.
 */
export function PanelResizer({
  pct,
  min,
  max,
  onChange,
}: {
  pct: number;
  min: number;
  max: number;
  onChange(pct: number, persist: boolean): void;
}) {
  const dragging = useRef(false);
  const last = useRef(pct);
  last.current = pct;

  const fromPointer = (el: HTMLElement, clientX: number): number | null => {
    const work = el.closest('.work');
    if (!work) return null;
    const r = work.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    return pctFromPointer(clientX, { left: r.left, width: r.width });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const v = fromPointer(e.currentTarget, e.clientX);
    if (v !== null && v !== last.current) onChange(v, false);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const v = fromPointer(e.currentTarget, e.clientX);
    onChange(v ?? last.current, true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = pctFromKey(pct, e.key, e.shiftKey);
    if (v === null) return;
    e.preventDefault();
    onChange(v, true);
  };

  return (
    <div
      className="fv2-resizer"
      data-testid="panel-resizer"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize findings panel"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={pct}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}
