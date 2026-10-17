import type { ReasonCode } from '@aduin/core';
import { useCallback, useRef, useState } from 'react';
import { useReview, type OwnerAsk } from '../../../state/review';
import { nextToReview, planControl } from './action-plan';
import { flatOrder, groupRows } from './groups';
import { computeOutcome, type OutcomeAction } from './outcome';
import type { ReviewView } from './types';
import { buildOwnerAsk } from './use-ask-owners';

export interface FindingActions {
  busy: boolean;
  ask(id: string): Promise<void>;
  closeRealIssue(id: string): Promise<void>;
  closeDismiss(id: string, reason: ReasonCode, note: string): Promise<void>;
  moveBack(id: string): Promise<void>;
}

type Next = 'next-review' | 'store' | 'keep';

/**
 * Glue between the v2 panel and the review store (the ONLY v2 module that calls store actions).
 * Snapshots the rows before the action, computes the D12 outcome text, awaits the store action,
 * moves selection, then replaces the store's generic toast text while keeping its Undo.
 * A rejected store action clears the in-flight flag and rethrows (no toast, selection unchanged).
 */
export function useFindingActions(view: ReviewView): FindingActions {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const run = useCallback(
    async (
      id: string,
      action: OutcomeAction,
      call: () => Promise<unknown>,
      opts: { ask?: OwnerAsk; reason?: ReasonCode; next: Next; undo: boolean },
    ): Promise<void> => {
      if (inFlight.current) return;
      const v = viewRef.current;
      const flat = flatOrder(groupRows(v.visible));
      const s = useReview.getState();
      const outcome = computeOutcome({
        rows: v.rows,
        id,
        action,
        ...(opts.ask ? { ask: opts.ask } : {}),
        ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
        result: s.result,
        policy: v.variance?.gatePolicy,
      });
      inFlight.current = true;
      setBusy(true);
      try {
        await call();
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
      const st = useReview.getState();
      if (opts.next === 'next-review') st.select(nextToReview(flat, id));
      st.showToast(outcome.text, opts.undo ? (useReview.getState().toast?.undo ?? null) : null);
    },
    [],
  );

  const ask = useCallback(
    async (id: string) => {
      const v = viewRef.current;
      const row = v.rows.find((r) => r.f.id === id) ?? null;
      const owners = row ? buildOwnerAsk(row, v) : null;
      const plan = planControl('ask-counsel', row, owners ? { ask: owners } : undefined);
      if (plan.kind !== 'call') return;
      const s = useReview.getState();
      const call =
        plan.call === 'accept'
          ? () => s.accept(id)
          : () => (plan.ask ? s.needsCounsel(id, plan.ask) : s.needsCounsel(id));
      await run(id, 'ask-counsel', call, {
        ...(plan.ask ? { ask: plan.ask } : {}),
        next: 'next-review',
        undo: true,
      });
    },
    [run],
  );

  const closeRealIssue = useCallback(
    async (id: string) => {
      const row = viewRef.current.rows.find((r) => r.f.id === id) ?? null;
      if (planControl('close-issue', row).kind !== 'open-close-modal') return;
      await run(id, 'close-real-issue', () => useReview.getState().accept(id), {
        next: 'next-review',
        undo: true,
      });
    },
    [run],
  );

  const closeDismiss = useCallback(
    async (id: string, reason: ReasonCode, note: string) => {
      const row = viewRef.current.rows.find((r) => r.f.id === id) ?? null;
      if (planControl('close-issue', row).kind !== 'open-close-modal') return;
      // P-4: dismiss keeps the store's own next-row selection
      await run(id, 'close-dismiss', () => useReview.getState().dismiss(id, reason, note.trim()), {
        reason,
        next: 'store',
        undo: true,
      });
    },
    [run],
  );

  const moveBack = useCallback(
    async (id: string) => {
      const row = viewRef.current.rows.find((r) => r.f.id === id) ?? null;
      if (planControl('move-back', row).kind !== 'call') return;
      // E3: restore gives no Undo
      await run(id, 'move-back', () => useReview.getState().restore(id), {
        next: 'keep',
        undo: false,
      });
    },
    [run],
  );

  return { busy, ask, closeRealIssue, closeDismiss, moveBack };
}
