import type { Owner } from '@aduin/core';
import { useEffect, useMemo } from 'react';
import { useReview } from '../../state/review';
import { useGpRequests } from '../counsel/GpRequestGroup';
import { usePackageView } from '../package/package-view';
import { useReviewView } from '../review/use-review-view';
import { OWNER_ORDER, questionItems, type QuestionItem } from '../variance/owner-groups';
import {
  countsFor,
  defaultTo,
  groupDocuments,
  isOverdue,
  neededByOf,
  requestStatus,
  waitingOf,
  type RequestCounts,
  type RequestDocGroup,
  type RequestStatus,
  roundOf,
  type ExtraQuestion,
} from './request-model';
import { useRequests } from './request-store';

export interface OwnerRequest {
  owner: Owner;
  to: string;
  neededBy: string;
  sentAt: number | undefined;
  /** Rounds sent (0 = never). */
  round: number;
  /** Questions (incl. added) at the last send. */
  sentCount: number;
  asked: Record<string, number>;
  extra: ExtraQuestion[];
  counts: RequestCounts;
  waiting: number;
  status: RequestStatus;
  overdue: boolean;
  questions: QuestionItem[];
}

/** The three owner requests of the open document (Requests page and drawer share it). */
export function useOwnerRequests() {
  const view = useReviewView();
  const doc = useReview((s) => s.doc);
  const pkg = usePackageView();
  const gp = useGpRequests();
  const load = useRequests((s) => s.load);
  const meta = useRequests((s) => s.meta);
  const docKey = doc ? (doc.packageId ?? doc.id) : null;
  useEffect(() => load(docKey), [docKey, load]);
  const items = useMemo(() => questionItems(view.rows), [view.rows]);
  const groups: RequestDocGroup[] = useMemo(
    () => (gp ? groupDocuments(gp, pkg?.references ?? []) : []),
    [gp, pkg],
  );
  const docs = gp?.length ?? 0;
  const requests = useMemo(
    () =>
      OWNER_ORDER.map((owner): OwnerRequest => {
        const m = meta[owner];
        const counts = countsFor(owner, items, docs);
        const status = requestStatus(counts, m);
        const neededBy = neededByOf(m);
        return {
          owner,
          to: m?.to?.trim() || defaultTo(owner, doc),
          neededBy,
          sentAt: m?.sentAt,
          round: roundOf(m),
          sentCount: m?.sentCount ?? (roundOf(m) ? counts.total + (m?.extra?.length ?? 0) : 0),
          asked: m?.asked ?? {},
          extra: m?.extra ?? [],
          counts,
          waiting: waitingOf(counts),
          status,
          overdue: isOverdue(status, neededBy),
          questions: items.filter((q) => q.owner === owner),
        };
      }),
    [items, docs, meta, doc],
  );
  return { view, doc, items, groups, requests, docKey };
}
