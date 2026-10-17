import type { MemoryLabel } from '../contracts/memory';
import { findingLink } from './gate';
import { questionKey } from '../variance/owners';
import {
  clampInterpretations,
  maskQuote,
  templateInterpretations,
  templateVersionDriftInterpretations,
} from './template-draft';
import type {
  CounselSheet,
  CounselSheetMeta,
  GateOwner,
  GateState,
  SheetFinding,
  SheetQuestion,
} from './types';

/** Labels from prior documents that keep a finding off the sheet. */
const EXCLUDED_LABELS: ReadonlySet<MemoryLabel> = new Set([
  'already_answered',
  'awaiting_counsel',
  'previously_dismissed',
]);

/**
 * Sheet inclusion (AC20/AC45, D-1). A finding is on the sheet when it is unanswered in this document
 * and either labelled `new` or the analyst sent it to counsel here (accepted / needs counsel).
 * - A clear A/B/C answer in this document removes it (the DOCX lists unanswered questions only).
 * - An `unclear` answer returns it as New.
 * - Dismissed in this document: excluded.
 * - Prior-memory labels `already_answered`, `awaiting_counsel`, `previously_dismissed`: excluded.
 */
export function includeOnSheet(state: GateState, label: MemoryLabel): boolean {
  const answer = state.counselAnswer ?? null;
  if (answer === 'A' || answer === 'B' || answer === 'C') return false;
  if (answer === 'unclear') return true;
  if (state.status === 'dismissed') return false;
  if (EXCLUDED_LABELS.has(label)) return false;
  if (label === 'new') return true;
  // dismissed_reconfirm: only when the analyst sent it to counsel in this document
  return state.status === 'accepted' || state.status === 'counsel';
}

export interface BuildSheetOptions {
  /** Interpretations per finding key (edited or AI drafts); template draft when absent. */
  drafts?: Readonly<Record<string, readonly string[]>>;
  /**
   * Variance: build the sheet for one owner. Change findings (`owners` set) are included when they
   * list the owner and keyed `<findingId>@<owner>`; error findings (no `owners`) belong to the
   * default owner, counsel, and keep the plain key. Absent = the unchanged all-questions sheet.
   */
  owner?: GateOwner;
}

/** State seen by one owner's question: that owner's answer replaces the finding-level answer. */
function ownerState(state: GateState, owner: GateOwner): GateState {
  const oa = state.ownerAnswers;
  if (!oa || !Object.prototype.hasOwnProperty.call(oa, owner)) return state;
  return { ...state, counselAnswer: oa[owner] ?? null };
}

export function buildCounselSheet(
  meta: CounselSheetMeta,
  findings: readonly SheetFinding[],
  states: Readonly<Record<string, GateState>>,
  labels: Readonly<Record<string, MemoryLabel>>,
  opts: BuildSheetOptions = {},
): CounselSheet {
  const questions: SheetQuestion[] = [];
  const owner = opts.owner;
  for (const f of findings) {
    if (owner && !(f.owners ?? ['counsel']).includes(owner)) continue;
    const base = states[f.id] ?? { status: 'open' };
    const state = owner ? ownerState(base, owner) : base;
    if (!includeOnSheet(state, labels[f.id] ?? 'new')) continue;
    const key = owner && f.owners ? questionKey(f.id, owner) : f.id;
    const draft = opts.drafts?.[key] ?? opts.drafts?.[f.id];
    questions.push({
      number: questions.length + 1,
      findingKey: key,
      link: findingLink(f.id),
      location: f.location,
      quote: maskQuote(f.quote),
      interpretations: draft?.length
        ? clampInterpretations(draft)
        : f.issue_class === 'version_drift' && f.change
          ? templateVersionDriftInterpretations(f.change)
          : templateInterpretations(f.issue_class),
    });
  }
  return { meta: owner ? { ...meta, owner } : meta, questions };
}
