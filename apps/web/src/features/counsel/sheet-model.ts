import {
  buildCounselSheet,
  templateQuestionText,
  type CounselOption,
  type CounselSheet,
  type CounselSheetMeta,
  type GateState,
  type MemoryLabel,
  type SheetFinding,
} from '@aduin/core';
import type { Row } from '../review/model';

/**
 * Counsel questions view model (app.html `#counsel`, Phase 08).
 * - Questions = findings marked Needs counsel, plus Accepted findings that block digitization.
 * - Not on the sheet (collapsed): prior-memory items Already answered / Awaiting counsel (D-3: an
 *   awaiting item can be answered in the app).
 * - The export (DOCX) is the core sheet builder: unanswered New/Accepted questions only (D-1).
 */
export const isClearAnswer = (o: CounselOption | null | undefined): boolean =>
  o === 'A' || o === 'B' || o === 'C';

export function isQuestion(r: Row): boolean {
  return r.status === 'counsel' || (r.status === 'accepted' && r.f.severity === 'critical');
}

export function questionRows(rows: readonly Row[]): Row[] {
  return rows.filter(isQuestion).sort((a, b) => a.f.order - b.f.order);
}

/** A question still needs counsel (no clear A/B/C answer in this document). */
export function needsAnswer(r: Row): boolean {
  return !isClearAnswer(r.triage?.counselAnswer);
}

export type QuestionState = 'new' | 'accepted' | 'answered' | 'unclear';

export function questionState(r: Row): QuestionState {
  const a = r.triage?.counselAnswer ?? null;
  if (isClearAnswer(a)) return 'answered';
  if (a === 'unclear') return 'unclear';
  return r.status === 'accepted' ? 'accepted' : 'new';
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
    };
    labels[r.f.id] = r.label;
  }
  return { states, labels };
}

export function sheetFinding(r: Row): SheetFinding {
  return {
    id: r.f.id,
    severity: r.f.severity,
    detector_kind: r.f.detector_kind,
    issue_class: r.f.issue_class,
    location: r.f.loc,
    quote: r.f.quote,
  };
}

/** Core sheet for the export: unanswered New/Accepted questions only, masked, clamped. */
export function buildSheet(meta: CounselSheetMeta, rows: readonly Row[]): CounselSheet {
  const qs = questionRows(rows);
  const { states, labels } = gateInputs(qs);
  return buildCounselSheet(meta, qs.map(sheetFinding), states, labels);
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

export function baseWording(r: Row, d: CounselDrafts): { text: string; source: WordingSource } {
  const ai = d.useAi ? d.ai[r.f.id] : undefined;
  if (ai) return { text: ai, source: 'ai' };
  return { text: templateQuestionText(r.f.issue_class, r.f.loc), source: 'template' };
}

export function wordingFor(r: Row, d: CounselDrafts): { text: string; source: WordingSource } {
  const e = d.edits[r.f.id];
  return e ? { text: e, source: 'edit' } : baseWording(r, d);
}
