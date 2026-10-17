import type { AiCandidate, BlockKind, Finding, StructureView } from '@aduin/core';

/** Wire types between the engine worker and the main thread (structured-clone safe). */
export type StageId = 'read' | 'structure' | 'checks' | 'ai' | 'done';
export type StageState = 'todo' | 'running' | 'done' | 'failed' | 'pending' | 'skipped';

export interface StageReport {
  id: StageId;
  state: StageState;
  /** One short line ("Done · 12 sections"). */
  sub: string;
}

export interface BlockView {
  id: string;
  kind: BlockKind;
  /** Block text = lines joined by one space (the anchor offset space). */
  text: string;
  /** Top-level section label (section_path[0]) or null before the first section. */
  section: string | null;
}

export interface SectionView {
  key: string;
  label: string;
  blockId: string;
}

export interface Span {
  start: number;
  end: number;
}

/** Engine finding plus display fields computed in the worker. No fingerprint (computed on the main thread). */
export interface FindingView extends Finding {
  classLabel: string;
  title: string;
  /** Short location, e.g. "§12". */
  ref: string;
  /** Human location, e.g. "Section 12". */
  loc: string;
  found: string | null;
  /** Sensitive spans relative to the block text (masked in the document and in the row by default). */
  sensitive: Span[];
  /** Document order (block index). */
  order: number;
  /** U1 locator chip (Phase 05, additive): full section path plus paragraph number in that section. */
  locator?: FindingLocator;
}

/** Where a finding sits: section path (outermost first) and 1-based paragraph within the section. */
export interface FindingLocator {
  path: string[];
  paragraph: number;
}

export interface EngineSettings {
  /** Optional sample id (for logs only). Never carries a firm. */
  sampleId?: string;
  /** E2E-only: force a stage failure (ignored unless built in e2e mode). */
  e2eFailStage?: StageId;
}

export interface EngineResult {
  docHash: string;
  bytes: number;
  blocks: BlockView[];
  sections: SectionView[];
  findings: FindingView[];
  stages: StageReport[];
  failedStage: StageId | null;
  /** Phase 02 (additive, optional): the #structure view model; absent when the structurer failed. */
  structure?: StructureView;
  /** Phase 05 (additive, optional): graph-selected AI candidates (core llm/candidates.ts, worker only). */
  aiCandidates?: AiCandidate[];
}

/** Context for verifying one AI result (where it came from). */
export interface VerifyAiContext {
  model: string;
  provenance: 'fresh' | 'cache';
}

export interface AiRejection {
  candidate_id?: string;
  reason: string;
}

/** verifyAi outcome: verified findings plus the rules hash of the injected rule set. */
export type VerifyAiResponse =
  | {
      ok: true;
      findings: FindingView[];
      rejected: AiRejection[];
      /** First 8 hex chars of the injected rules hash, or 'none'. */
      rulesHash8: string;
      /** "N of M firm rules applied". */
      rulesApplied: number;
      rulesTotal: number;
    }
  | { ok: false; error: 'doc_not_retained' | 'schema' };

export interface EngineApi {
  analyze(
    bytes: Uint8Array,
    settings: EngineSettings,
    onStage: (s: StageReport) => void,
  ): Promise<EngineResult>;
  /**
   * Phase 05 (G12/G13): verify an AI result against a retained document graph (LRU of 2, by docHash).
   * Schema check, quote locate, snapToSentence, severity cap, mask. Never throws across Comlink.
   */
  verifyAi(
    result: unknown,
    docHash: string,
    injectedRuleTexts: string[],
    ctx: VerifyAiContext,
  ): Promise<VerifyAiResponse>;
  /** First 8 hex chars of the injected rules hash for these rule texts, or 'none'. */
  rulesHash8(ruleTexts: string[]): Promise<string>;
  /** Drop every retained graph. */
  dispose(): Promise<void>;
}
