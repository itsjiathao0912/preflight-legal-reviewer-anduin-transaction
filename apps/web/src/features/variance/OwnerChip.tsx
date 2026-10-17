import type { VarianceMeta } from '@aduin/core';
import { useEffect } from 'react';
import { useReview } from '../../state/review';
import type { Row } from '../review/model';
import {
  askedOwners,
  choiceOf,
  effectiveOwners,
  OWNER_CHOICES,
  ownersLabel,
  type OwnerChoice,
} from './owner-groups';
import { useOwners } from './owner-store';

/** Tooltip on the read-only owner select once a question exists. */
export const OWNER_LOCKED_TEXT =
  'A question was already asked; the owner is fixed for this review.';
/** Tooltip on Ask owner while the owner is the local-only "You". */
export const CHANGE_OWNER_FIRST = 'Change the owner first';

/**
 * Variance Phase 04 (B1): owners of one change row. Suggested owners come from the V1 routing table
 * (worker-decoded meta); the analyst may override them while no question exists (persisted in
 * `uiState`); once asked, the asked owners are shown and the choice is read-only.
 */
export function useRowOwners(r: Row, meta: VarianceMeta | undefined) {
  const docId = useReview((s) => s.doc?.id ?? null);
  const load = useOwners((s) => s.load);
  const override = useOwners((s) => (s.docId === docId ? s.choices[r.f.id] : undefined));
  useEffect(() => {
    void load(docId);
  }, [docId, load]);
  const suggested = meta?.owners ?? [];
  const asked = askedOwners(r.triage);
  const eff = effectiveOwners(suggested, override);
  return {
    suggested,
    owners: asked.length ? asked : eff.owners,
    source: eff.source,
    choice: override ?? choiceOf(suggested),
    asked: asked.length > 0,
  };
}

export function OwnerChip({ r, meta }: { r: Row; meta: VarianceMeta | undefined }) {
  const o = useRowOwners(r, meta);
  return (
    <span
      className="ochip"
      data-testid="owner-chip"
      data-owners={o.owners.join(',')}
      data-owner-source={o.source}
      title={`Owner: ${ownersLabel(o.owners)}`}
    >
      {ownersLabel(o.owners)}
    </span>
  );
}

/** "Suggested owner" select with the one-line routing reason (expanded row). */
export function OwnerSelect({ r, meta }: { r: Row; meta: VarianceMeta | undefined }) {
  const o = useRowOwners(r, meta);
  const setChoice = useOwners((s) => s.setChoice);
  const showToast = useReview((s) => s.showToast);
  const id = `own-${r.f.id}`;
  return (
    <div className="ownrow" data-testid="owner-row">
      <label htmlFor={id}>Suggested owner</label>
      <select
        id={id}
        data-testid="owner-select"
        value={o.choice}
        disabled={o.asked}
        title={o.asked ? OWNER_LOCKED_TEXT : undefined}
        aria-describedby={meta?.owner_reason ? `${id}-why` : undefined}
        onChange={(e) => {
          const v = e.target.value as OwnerChoice;
          void setChoice(r.f.id, v === choiceOf(o.suggested) ? null : v);
          showToast(`Owner is now ${OWNER_CHOICES.find((c) => c.value === v)?.label ?? v}.`);
        }}
      >
        {OWNER_CHOICES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {meta?.owner_reason ? (
        <span className="mut" id={`${id}-why`} data-testid="owner-reason">
          Suggested: {ownersLabel(o.suggested)}. {meta.owner_reason}
        </span>
      ) : null}
    </div>
  );
}
