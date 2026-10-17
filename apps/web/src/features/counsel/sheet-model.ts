import {
  buildCounselSheet,
  templateQuestionText,
  type CounselOption,
  type CounselSheet,
  type CounselSheetMeta,
  type GateState,
  type MemoryLabel,
  type Owner,
  type SheetFinding,
} from '@aduin/core';
import type { Row } from '../review/model';
import {
  askedOwners,
  isChangeRow,
  isClear,
  isErrorQuestion,
  OWNER_ORDER,
  type QuestionItem,
} from '../variance/owner-groups';

/**
 * Counsel questions view model (app.html `#counsel`, Phase 08).
 * - Questions = findings marked Needs counsel, plus Accepted findings that block digitization.
 * - Not on the sheet (collapsed): prior-memory items Already answered / Awaiting counsel (D-3: an
 *   awaiting item can be answered in the app).
 * - The export (DOCX) is the core sheet builder: unanswered New/Accepted questions only (D-1).
 */
export const isClearAnswer = (o: CounselOption | null | undefined): boolean =>
  o === 'A' || o === 'B' || o === 'C';

/**
 * Variance P04 (H5): a change finding is a question once at least one owner was asked (asked
 * markers in `ownerAnswers`); error findings keep the Phase 08 rule.
 */
export function isQuestion(r: Row): boolean {
  return isChangeRow(r) ? askedOwners(r.triage).length > 0 : isErrorQuestion(r);
}

export function questionRows(rows: readonly Row[]): Row[] {
  return rows.filter(isQuestion).sort((a, b) => a.f.order - b.f.order);
}

/**
 * A question still needs an answer (no clear A/B/C answer in this document). A change finding needs
 * one while ANY asked owner has no clear answer.
 */
export function needsAnswer(r: Row): boolean {
  if (isChangeRow(r)) {
    const owners = askedOwners(r.triage);
    if (owners.length) return owners.some((o) => !isClear(r.triage?.ownerAnswers?.[o]));
  }
  return !isClearAnswer(r.triage?.counselAnswer);
}

export type QuestionState = 'new' | 'accepted' | 'answered' | 'unclear';

export function questionState(r: Row): QuestionState {
  const a = r.triage?.counselAnswer ?? null;
  if (isClearAnswer(a)) return 'answered';
  if (a === 'unclear') return 'unclear';
  return r.status === 'accepted' ? 'accepted' : 'new';
}

/** State of one question (per owner for change findings). */
export function itemState(q: QuestionItem): QuestionState {
  if (!q.change) return questionState(q.row);
  if (isClearAnswer(q.answer)) return 'answered';
  if (q.answer === 'unclear') return 'unclear';
  return 'new';
}

export interface PriorItems {
  answered: Row[];
  awaiting: Row[];
}

/** Prior-memory items shown collapsed under the sheet (never exported). */
export function priorItems(rows: readonly Row[]): PriorItems {
  const answered: Row[] = [];
  const awaiting: Row[] = [];
  for (const r of rows) {
    if (isQuestion(r) || r.status === 'dismissed') continue;
    if (r.label !== 'already_answered' && r.label !== 'awaiting_counsel') continue;
    if (r.label === 'already_answered' || isClearAnswer(r.triage?.counselAnswer)) answered.push(r);
    else awaiting.push(r);
  }
  const byOrder = (a: Row, b: Row) => a.f.order - b.f.order;
  return { answered: answered.sort(byOrder), awaiting: awaiting.sort(byOrder) };
}

export function gateInputs(rows: readonly Row[]): {
  states: Record<string, GateState>;
  labels: Record<string, MemoryLabel>;
} {
  const states: Record<string, GateState> = {};
  const labels: Record<string, MemoryLabel> = {};
  for (const r of rows) {
    states[r.f.id] = {
      status: r.status,
      reasonCode: r.triage?.reasonCode ?? null,
      counselAnswer: r.triage?.counselAnswer ?? null,
      // Variance P04 (B4): per-owner answers; a finding resolves only when every asked owner answered
      ...(r.triage?.ownerAnswers ? { ownerAnswers: r.triage.ownerAnswers } : {}),
    };
    labels[r.f.id] = r.label;
  }
  return { states, labels };
}

export function sheetFinding(r: Row): SheetFinding {
  const owners = isChangeRow(r) ? askedOwners(r.triage) : [];
  return {
    id: r.f.id,
    severity: r.f.severity,
    detector_kind: r.f.detector_kind,
    issue_class: r.f.issue_class,
    location: r.f.loc,
    quote: r.f.quote,
    ...(owners.length ? { owners } : {}),
  };
}

/** Change questions use the deterministic V1 template options (old vs new text) from the engine. */
function changeDrafts(rows: readonly Row[]): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {};
  for (const r of rows)
    if (isChangeRow(r) && r.f.detail.interpretations.length)
      out[r.f.id] = r.f.detail.interpretations;
  return out;
}

/**
 * Core sheet for the export: unanswered New/Accepted questions only, masked, clamped. With `owner`
 * (per-owner export, C1): only that owner's questions, keyed `<findingId>@<owner>` for change
 * findings (error findings belong to Counsel). Without it: error questions, then each owner's change
 * questions, renumbered (an error-only document gives exactly the Phase 08 sheet).
 */
export function buildSheet(
  meta: CounselSheetMeta,
  rows: readonly Row[],
  owner?: Owner,
): CounselSheet {
  const qs = questionRows(rows);
  const { states, labels } = gateInputs(qs);
  const findings = qs.map(sheetFinding);
  const drafts = changeDrafts(qs);
  if (owner) return buildCounselSheet(meta, findings, states, labels, { owner, drafts });
  const errors = findings.filter((f) => !f.owners);
  const base = buildCounselSheet(meta, errors, states, labels);
  const changed = findings.filter((f) => f.owners);
  if (!changed.length) return base;
  const more = OWNER_ORDER.flatMap(
    (o) => buildCounselSheet(meta, changed, states, labels, { owner: o, drafts }).questions,
  );
  const questions = [...base.questions, ...more].map((q, i) => ({ ...q, number: i + 1 }));
  return { meta: base.meta, questions };
}

export interface CounselDrafts {
  /** Wording edited by the analyst (masked + clamped on save). */
  edits: Record<string, string>;
  /** AI draft wording (masked + clamped, L6). */
  ai: Record<string, string>;
  aiModel: string | null;
  /** Show the AI draft where one exists (the template is the default). */
  useAi: boolean;
}

export const EMPTY_DRAFTS: CounselDrafts = { edits: {}, ai: {}, aiModel: null, useAi: false };

export type WordingSource = 'edit' | 'ai' | 'template';

/**
 * Base wording of a question. Change questions always use the deterministic template (C1: no AI
 * draft path for them, so 0 live AI calls are made for change questions).
 */
export function baseWording(r: Row, d: CounselDrafts): { text: string; source: WordingSource } {
  const ai = d.useAi && !isChangeRow(r) ? d.ai[r.f.id] : undefined;
  if (ai) return { text: ai, source: 'ai' };
  return { text: templateQuestionText(r.f.issue_class, r.f.loc), source: 'template' };
}

/** Wording of one question; `key` = the question key (per-owner edits for change findings). */
export function wordingFor(
  r: Row,
  d: CounselDrafts,
  key: string = r.f.id,
): { text: string; source: WordingSource } {
  const e = d.edits[key];
  return e ? { text: e, source: 'edit' } : baseWording(r, d);
}

/** Questions that may get an AI draft: error questions only (change questions never, C1/E3). */
export function aiDraftRows(qs: readonly Row[]): Row[] {
  return qs.filter((r) => !isChangeRow(r));
}
