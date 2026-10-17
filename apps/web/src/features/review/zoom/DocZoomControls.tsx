import { useEffect, useRef, useState } from 'react';
import { PRESETS, type ZoomAction } from './zoom-math';

export interface DocZoomControlsProps {
  pct: number;
  mode: 'fit' | 'manual';
  dispatch(a: ZoomAction): void;
}

/** D15 controls: [-] [100% v] [+] [Fit width]. */
export function DocZoomControls({ pct, mode, dispatch }: DocZoomControlsProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent | MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = `${pct}%`;
  const fit = mode === 'fit';

  return (
    <div
      ref={wrapRef}
      className="fv2-zoom"
      role="group"
      aria-label="Document zoom"
      data-testid="doc-zoom-controls"
    >
      <button
        type="button"
        className="fv2-zoom-btn"
        data-testid="zoom-out"
        aria-label="Zoom out"
        title="Zoom out (Ctrl/Cmd -)"
        onClick={() => dispatch({ type: 'out' })}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        ref={menuBtnRef}
        type="button"
        className="fv2-zoom-btn"
        data-testid="zoom-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Zoom level ${label}`}
        title="Zoom level"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <span aria-hidden="true"> ▾</span>
      </button>
      {open && (
        <ul className="fv2-zoom-menu" role="menu" aria-label="Zoom presets">
          {PRESETS.map((p) => (
            <li key={p} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!fit && p === pct}
                data-testid={`zoom-preset-${p}`}
                onClick={() => {
                  dispatch({ type: 'preset', pct: p });
                  setOpen(false);
                  menuBtnRef.current?.focus();
                }}
              >
                {p}%
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="fv2-zoom-btn"
        data-testid="zoom-in"
        aria-label="Zoom in"
        title="Zoom in (Ctrl/Cmd +)"
        onClick={() => dispatch({ type: 'in' })}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        className="fv2-zoom-btn"
        data-testid="zoom-fit"
        aria-pressed={fit}
        title="Fit width (Ctrl/Cmd 0)"
        onClick={() => dispatch({ type: 'fit' })}
      >
        Fit width
      </button>
    </div>
  );
}
