import type { ReasonCode } from '@aduin/core';
import { useCallback, useRef, useState } from 'react';
import { memoryNotSavedNote, useReview, type OwnerAsk } from '../../../state/review';
import { nextToReview, planControl } from './action-plan';
import { flatOrder, groupRows } from './groups';
import { computeOutcome, type OutcomeAction } from './outcome';
import type { ReviewView } from './types';
import { buildOwnerAsk } from './use-ask-owners';

export interface FindingActions {
  busy: boolean;
  /** Each action resolves `true` when the store saved it, `false` when skipped or failed. */
  ask(id: string): Promise<boolean>;
  closeRealIssue(id: string): Promise<boolean>;
  closeDismiss(id: string, reason: ReasonCode, note: string): Promise<boolean>;
  moveBack(id: string): Promise<boolean>;
}

/** R9: toast shown when a store write fails (modal stays open, selection unchanged). */
export const SAVE_FAILED = 'Could not save. Try again.';

type Next = 'next-review' | 'keep';

/**
 * Glue between the v2 panel and the review store (the ONLY v2 module that calls store actions).
 * Snapshots the rows before the action, computes the D12 outcome text, awaits the store action,
 * moves selection, then replaces the store's generic toast text while keeping its Undo.
 * A rejected store action clears the in-flight flag, shows SAVE_FAILED and resolves `false`
 * (selection unchanged, R9). A call skipped by the in-flight guard resolves `false` (R10).
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
    ): Promise<boolean> => {
      if (inFlight.current) return false;
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
      const toastBefore = s.toast?.id ?? null;
      const seqBefore = s.selectSeq ?? 0;
      const selBefore = s.selectedId;
      // dismiss re-selects inside the store once; that is not a user move (R12)
      const storeSelects = action === 'close-dismiss' ? 1 : 0;
      inFlight.current = true;
      setBusy(true);
      let produced: { msg: string; undo: (() => void) | null } | null;
      try {
        await call();
        // R13: only the toast this action produced may lend its text and Undo
        const t = useReview.getState().toast;
        produced = t && t.id !== toastBefore ? t : null;
      } catch {
        useReview.getState().showToast(SAVE_FAILED, null);
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
      const st = useReview.getState();
      // P-12: keep the store's "not saved to memory" note (withNote) on the replaced toast text
      const note = memoryNotSavedNote(st.doc);
      const kept = produced?.msg ?? '';
      const text =
        note && kept.trimEnd().endsWith(note) ? `${outcome.text.trimEnd()} ${note}` : outcome.text;
      // R12: the analyst did not pick another row while the call was in flight
      const userMoved =
        (st.selectSeq ?? 0) > seqBefore + storeSelects ||
        (!storeSelects && st.selectedId !== selBefore);
      // R3: dismiss also lands on the next To-review row, never on a Sent row
      if (opts.next === 'next-review' && !userMoved) st.select(nextToReview(flat, id));
      st.showToast(text, opts.undo ? (produced?.undo ?? null) : null);
      return true;
    },
    [],
  );

  const ask = useCallback(
    async (id: string) => {
      const v = viewRef.current;
      const row = v.rows.find((r) => r.f.id === id) ?? null;
      const owners = row ? buildOwnerAsk(row, v) : null;
      const plan = planControl('ask-counsel', row, owners ? { ask: owners } : undefined);
      if (plan.kind !== 'call') return false;
      const s = useReview.getState();
      const call =
        plan.call === 'accept'
          ? () => s.accept(id)
          : () => (plan.ask ? s.needsCounsel(id, plan.ask) : s.needsCounsel(id));
      return run(id, 'ask-counsel', call, {
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
      if (planControl('close-issue', row).kind !== 'open-close-modal') return false;
      return run(id, 'close-real-issue', () => useReview.getState().accept(id), {
        next: 'next-review',
        undo: true,
      });
    },
    [run],
  );

  const closeDismiss = useCallback(
    async (id: string, reason: ReasonCode, note: string) => {
      const row = viewRef.current.rows.find((r) => r.f.id === id) ?? null;
      if (planControl('close-issue', row).kind !== 'open-close-modal') return false;
      return run(id, 'close-dismiss', () => useReview.getState().dismiss(id, reason, note.trim()), {
        reason,
        next: 'next-review',
        undo: true,
      });
    },
    [run],
  );

  const moveBack = useCallback(
    async (id: string) => {
      const row = viewRef.current.rows.find((r) => r.f.id === id) ?? null;
      if (planControl('move-back', row).kind !== 'call') return false;
      // E3: restore gives no Undo
      return run(id, 'move-back', () => useReview.getState().restore(id), {
        next: 'keep',
        undo: false,
      });
    },
    [run],
  );

  return { busy, ask, closeRealIssue, closeDismiss, moveBack };
}
