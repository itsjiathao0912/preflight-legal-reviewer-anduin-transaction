import { useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { BaselineModal } from './BaselineModal';
import { useVariance } from './variance-store';

/** Findings header control `vs <baseline> ▾` (documents with a firm only: unknown firm = no baseline). */
export function BaselineControl() {
  const doc = useReview((s) => s.doc);
  const phase = useReview((s) => s.phase);
  const baseline = useVariance((s) => s.baseline);
  const candidates = useVariance((s) => s.candidates);
  const status = useVariance((s) => s.status);
  const loadCandidates = useVariance((s) => s.loadCandidates);
  const choose = useVariance((s) => s.choose);
  const [open, setOpen] = useState(false);
  if (!doc?.firmId || phase !== 'ready') return null;
  const label = baseline && status !== 'none' ? `vs ${baseline.name}` : 'No baseline';
  return (
    <>
      <button
        className="stagebtn"
        type="button"
        data-testid="baseline-control"
        aria-haspopup="dialog"
        aria-label={`${label}. Change baseline`}
        onClick={() => {
          void loadCandidates();
          setOpen(true);
        }}
      >
        <Icon name="compare" />
        <span>{label}</span>
        <Icon name="chevd" />
      </button>
      <BaselineModal
        open={open}
        firmName={doc.firmName}
        candidates={candidates}
        current={baseline?.docId ?? null}
        onCancel={() => setOpen(false)}
        onChoose={async (id) => {
          const r = await choose(id);
          if (r.ok) setOpen(false);
          return r.ok;
        }}
      />
    </>
  );
}
