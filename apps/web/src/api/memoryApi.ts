import type { ActiveDecision, CounselOption, IssueClass, ReasonCode } from '@aduin/core';

/**
 * Web-side Memory API (contract: @aduin/core contracts/memory). Satisfied by the Dexie stub now and by
 * the real Worker client in Phase 08. Semantics: append-only decisions, one active decision per
 * fingerprint (per firm), revoke instead of delete, reason_code required for dismiss.
 */
export interface DecideInput {
  client_op_id: string;
  law_firm_id: string;
  finding_ref: string;
  decision: 'dismissed' | 'accepted';
  reason_code?: ReasonCode;
  note?: string;
  quote_text: string;
  fingerprint: string;
  issue_class: IssueClass;
  pattern_key?: string;
  fund_name?: string;
  doc_version_label?: string;
  section_path?: string[];
  quote_snippet?: string;
  decided_by_name: string;
}

export interface AnswerInput {
  client_op_id: string;
  law_firm_id: string;
  fingerprint: string;
  issue_class: IssueClass;
  counsel_option: CounselOption;
  counsel_note?: string;
  fund_name?: string;
  quote_snippet?: string;
  decided_by_name: string;
}

export class MemoryApiError extends Error {
  constructor(
    readonly code: 'invalid_request' | 'not_found' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'MemoryApiError';
  }
}

export interface MemoryApi {
  /** Active decisions for these fingerprints (at most limits.memoryLookupMax per call). */
  lookup(lawFirmId: string, fingerprints: string[]): Promise<ActiveDecision[]>;
  decide(input: DecideInput): Promise<ActiveDecision>;
  /** Record a counsel answer (P08 UI; seeded in tests now). */
  answer(input: AnswerInput): Promise<ActiveDecision>;
  /** Revoke (never delete). Returns the decision that is active afterwards (always null in v1). */
  revoke(decisionId: string, reason: string): Promise<ActiveDecision | null>;
}
