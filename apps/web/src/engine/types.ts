import type { BlockKind, Finding, StructureView } from '@aduin/core';

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
}

export interface EngineApi {
  analyze(
    bytes: Uint8Array,
    settings: EngineSettings,
    onStage: (s: StageReport) => void,
  ): Promise<EngineResult>;
}
