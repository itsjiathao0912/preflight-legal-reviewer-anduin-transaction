import { useEffect, useRef } from 'react';
import type { Row } from '../model';
import { actionForKey } from './shortcut-guard';
import type { Control } from './types';

export interface ShortcutArgs {
  flat: readonly Row[];
  selectedId: string | null;
  select(id: string | null): void;
  onControl(c: Control): void;
  barEnabled(c: Control): boolean;
}

/** E25: focus the row after J/K like the old FindingsScreen handler (no CSS.escape dependency, E15). */
export function focusRow(id: string): void {
  requestAnimationFrame(() => {
    const rows = document.querySelectorAll<HTMLElement>('[data-testid="finding-row"]');
    for (const el of rows) {
      if (el.getAttribute('data-finding-id') === id) {
        el.focus({ preventScroll: true });
        return;
      }
    }
  });
}

/** D14: J/K walk `flat` (no wrap), C = Ask counsel, X = Close issue; window keydown while mounted. */
export function useShortcuts(args: ShortcutArgs): void {
  const ref = useRef(args);
  ref.current = args;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = actionForKey(e);
      if (!action) return;
      const a = ref.current;
      if (action === 'next' || action === 'prev') {
        const ids = a.flat.map((r) => r.f.id);
        if (!ids.length) return;
        const i = a.selectedId ? ids.indexOf(a.selectedId) : -1;
        const j =
          action === 'next'
            ? i < 0
              ? 0
              : Math.min(ids.length - 1, i + 1)
            : i < 0
              ? 0
              : Math.max(0, i - 1);
        e.preventDefault();
        const id = ids[j]!;
        if (id !== a.selectedId) a.select(id);
        focusRow(id);
        return;
      }
      if (!a.barEnabled(action)) return;
      e.preventDefault();
      a.onControl(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
