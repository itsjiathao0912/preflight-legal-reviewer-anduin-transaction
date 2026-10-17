import type { VarianceMeta } from '@aduin/core';
import { useEffect } from 'react';
import { useReview, type OwnerAsk } from '../../../state/review';
import { CHANGE_OWNER_FIRST } from '../../variance/OwnerChip';
import { askedOwners, effectiveOwners, isChangeRow } from '../../variance/owner-groups';
import type { OwnerChoice } from '../../variance/owner-groups';
import { useOwners } from '../../variance/owner-store';
import type { Row } from '../model';
import type { ReviewView } from './types';

/** E23: ordinary change rows take meta from the variance pass, regression rows from regression meta. */
export function metaFor(row: Row, view: ReviewView): VarianceMeta | undefined {
  return view.variance?.meta[row.f.id] ?? view.regressionMeta[row.f.id];
}

function ownersOf(row: Row, view: ReviewView, override: OwnerChoice | undefined) {
  const meta = metaFor(row, view);
  const asked = askedOwners(row.triage);
  const eff = effectiveOwners(meta?.owners ?? [], override);
  return { owners: asked.length ? asked : eff.owners, source: eff.source };
}

export interface AskOwners {
  ask: OwnerAsk | null;
  askDisabled: boolean;
  askTitle: string | undefined;
}

const NONE: AskOwners = { ask: null, askDisabled: false, askTitle: undefined };

/** Null-safe twin of `useRowOwners` for the selected row; feeds the bar's Ask owner state. */
export function useAskOwners(row: Row | null, view: ReviewView): AskOwners {
  const docId = useReview((s) => s.doc?.id ?? null);
  const load = useOwners((s) => s.load);
  const rowId = row?.f.id ?? null;
  const override = useOwners((s) =>
    rowId !== null && s.docId === docId ? s.choices[rowId] : undefined,
  );
  useEffect(() => {
    void load(docId);
  }, [docId, load]);
  if (!row || !isChangeRow(row)) return NONE;
  const { owners, source } = ownersOf(row, view, override);
  const askDisabled = owners.length === 0 && row.status !== 'counsel';
  return {
    ask: owners.length > 0 ? { owners, source } : null,
    askDisabled,
    askTitle: askDisabled ? CHANGE_OWNER_FIRST : undefined,
  };
}

/** Imperative twin for `useFindingActions.ask(id)`: same E23 rules through `getState()`. */
export function buildOwnerAsk(row: Row, view: ReviewView): OwnerAsk | null {
  if (!isChangeRow(row)) return null;
  const docId = useReview.getState().doc?.id ?? null;
  const o = useOwners.getState();
  const override = o.docId === docId ? o.choices[row.f.id] : undefined;
  const { owners, source } = ownersOf(row, view, override);
  return owners.length > 0 ? { owners, source } : null;
}
