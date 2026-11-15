import { Icon } from '../components/ui/icon';
import { Popover } from '../components/ui/popover';
import { gatePillView } from '../features/gate/gate-pill';
import { useGatePopover } from '../features/gate/gate-store';
import { CoverageLine } from '../features/gate/CoverageLine';
import { GateReasons } from '../features/gate/GateReasons';
import { PackageGateReasons } from '../features/gate/PackageGateReasons';
import { usePackageView } from '../features/package/package-view';
import { useReviewView } from '../features/review/use-review-view';
import { useReview } from '../state/review';

/** "Sections 2, 4, 7A, 9" (max 4, then "+N") from the blocking findings' locations. */
export function gateSectionsLine(locs: readonly string[]): string {
  const secs = [
    ...new Set(
      locs.map((l) => /^sections?\s+(.+)$/i.exec(l.trim())?.[1]?.trim() ?? '').filter(Boolean),
    ),
  ];
  // Natural document order: number, then letter suffix; unparseable last (stable sort keeps order).
  const key = (s: string) => {
    const m = /^(\d+)([A-Za-z]*)/.exec(s);
    return m ? { n: Number(m[1]), x: m[2]!.toUpperCase() } : null;
  };
  secs.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (!ka || !kb) return ka ? -1 : kb ? 1 : 0;
    return ka.n - kb.n || (ka.x < kb.x ? -1 : ka.x > kb.x ? 1 : 0);
  });
  if (!secs.length) return '';
  const shown = secs.slice(0, 4).join(', ');
  const more = secs.length > 4 ? ` +${secs.length - 4}` : '';
  return `${secs.length === 1 ? 'Section' : 'Sections'} ${shown}${more}`;
}

export function GateButton() {
  const open = useGatePopover((s) => s.open);
  const setOpen = useGatePopover((s) => s.setOpen);
  const hasDocument = useReview((s) => s.result !== null);
  const { gate, rows, variancePending } = useReviewView();
  const pkg = usePackageView();
  const pkgReasons = pkg?.gateReasons ?? [];
  const pkgBlocks = pkgReasons.filter((r) => r.level === 'block');
  // Spread the core gate so `unreadable` (no-text document) survives and still wins.
  const merged = {
    ...gate,
    status: gate.status === 'blocked' || pkgBlocks.length > 0 ? ('blocked' as const) : gate.status,
    reasons: [...gate.reasons, ...pkgBlocks],
  };
  const base = gatePillView(hasDocument, merged);
  // Variance P02 (F2, UI-only): while a baseline resolves and the pass runs, the pill never shows
  // Ready; the gate itself keeps exactly two states (computeGate unchanged).
  const pending = hasDocument && variancePending;
  const v =
    pending && base.state === 'ready'
      ? { ...base, className: 'gate pending', label: 'Checking changes' }
      : base;
  const where =
    v.state === 'blocked'
      ? gateSectionsLine(
          gate.reasons.map((r) => rows.find((x) => x.f.id === r.findingKey)?.f.loc ?? ''),
        )
      : '';
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Digitization gate"
      className="pop-gate"
      testId="gate-popover"
      side="right"
      align="end"
      trigger={
        <button
          className={v.className}
          type="button"
          data-testid="gate-button"
          data-gate-state={pending && base.state === 'ready' ? 'pending' : v.state}
          data-variance-pending={pending ? 'true' : 'false'}
        >
          <Icon name={v.icon} />
          <span className="lbl" aria-live="polite">
            {v.label}
            {where ? (
              <small className="gwhere" data-testid="gate-sections">
                {where}
              </small>
            ) : null}
          </span>
          {v.state === 'blocked' ? (
            <span className="gn" aria-hidden="true">
              {merged.reasons.length}
            </span>
          ) : null}
          {pending && base.state !== 'ready' ? (
            <span className="gpend" data-testid="gate-pending" aria-live="polite">
              Checking changes
            </span>
          ) : null}
          <Icon name="chev" />
        </button>
      }
    >
      <h2>{v.title}</h2>
      <p>{v.body}</p>
      {v.state === 'none' ? null : (
        <>
          <GateReasons reasons={gate.reasons} rows={rows} onGo={() => setOpen(false)} />
          <PackageGateReasons reasons={pkgReasons} />
          <CoverageLine placement="popover" />
        </>
      )}
    </Popover>
  );
}
