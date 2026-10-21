import type { KeyboardEvent } from 'react';
import type { FindingsView } from '../../../state/shell';

const VIEWS: ReadonlyArray<{ id: FindingsView; label: string }> = [
  { id: 'issues', label: 'Issues' },
  { id: 'flow', label: 'Form flow' },
  { id: 'sources', label: 'Sources' },
];

/** Segmented switch at the top of the Findings panel: Issues, Form flow, Sources. */
export function ViewSwitch({
  value,
  onChange,
  counts,
}: {
  value: FindingsView;
  onChange: (v: FindingsView) => void;
  counts: { issues: number; breaks: number; missing: number };
}) {
  const note: Record<FindingsView, string> = {
    issues: String(counts.issues),
    flow: counts.breaks ? `${counts.breaks} ${counts.breaks === 1 ? 'break' : 'breaks'}` : '',
    sources: counts.missing ? `${counts.missing} missing` : '',
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = VIEWS.findIndex((v) => v.id === value);
    const n =
      e.key === 'ArrowRight' ? (i + 1) % VIEWS.length : (i - 1 + VIEWS.length) % VIEWS.length;
    const next = VIEWS[n]!.id;
    onChange(next);
    requestAnimationFrame(() => document.getElementById(`fv-tab-${next}`)?.focus());
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div
      className="seg fv2-views"
      role="tablist"
      aria-label="Findings views"
      data-testid="findings-view-switch"
      onKeyDown={onKey}
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          id={`fv-tab-${v.id}`}
          data-testid={`findings-view-${v.id}`}
          aria-selected={value === v.id}
          aria-controls="fv-view-panel"
          tabIndex={value === v.id ? 0 : -1}
          onClick={() => onChange(v.id)}
        >
          {v.label}
          {note[v.id] ? <span className="dim fv2-views-n"> {note[v.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}
