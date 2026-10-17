import type { FindingView } from '../../engine/types';

/** U1 locator chip: section path and paragraph number in that section (e.g. "12 › (b) · ¶ 3"). */
export function locatorText(f: Pick<FindingView, 'locator'>): string | null {
  const l = f.locator;
  if (!l) return null;
  const path = l.path.length ? l.path.map((p) => (p.length > 48 ? `${p.slice(0, 47)}…` : p)) : [];
  const where = path.length ? path.join(' › ') : 'Before the first section';
  return `${where} · ¶ ${l.paragraph}`;
}

export function LocatorChip({ f }: { f: FindingView }) {
  const text = locatorText(f);
  if (!text || !f.locator) return null;
  const where = f.locator.path.length ? f.locator.path.join(', ') : 'before the first section';
  return (
    <span
      className="tag t-loc"
      data-testid="finding-locator"
      aria-label={`Location: ${where}, paragraph ${f.locator.paragraph}`}
      title={text}
    >
      {text}
    </span>
  );
}
