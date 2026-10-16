import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// Minimal render helper so the scaffold does not need @testing-library (Phase 03 may add it).
let container: HTMLElement | null = null;

export function render(ui: ReactElement): HTMLElement {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return container;
}

export const screen = {
  getHeading(): string | null {
    return container?.querySelector('h1')?.textContent ?? null;
  },
};
