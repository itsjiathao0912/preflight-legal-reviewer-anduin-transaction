import type {
  AiCandidate,
  BlockKind,
  CrossDocDefinition,
  DiffMode,
  DiffResult,
  DiffStage,
  Finding,
  OcrResult,
  OutlineDraft,
  PackageFacts,
  PrimaryFacts,
  Region,
  StructureView,
} from '@aduin/core';

export type { DiffMode, DiffResult, DiffStage } from '@aduin/core';

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
  /** Phase 06 (additive): 1-based page of the block's first line (PDF / OCR sources). */
  page?: number;
  /** Phase 06 (additive): normalized 0..1 region of the block's first line on its page. */
  region?: Region;
  /** Phase 06 (additive): OCR page confidence of the block's page (OCR sources only). */
  conf?: number;
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
  /**
   * Phase 06 (additive): "based on reconstructed numbering" on numbering-dependent findings
   * (cross-references, conditionals, flow) of a DOCX whose list numbering was reconstructed.
   */
  numberingNote?: string;
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
  /**
   * Intake Phase 2 (additive): definitions from the package's reference documents (LPA / PPM).
   * Offering-noun `undefined-term` findings the package defines are removed in the checks stage.
   */
  packageDefs?: CrossDocDefinition[];
  /** Intake Phase 2 (additive): also return `EngineResult.packageFacts` (primary facts). */
  packageFacts?: boolean;
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
  /** Phase 09 (additive, optional): form logic outline draft (no document name); absent without structure. */
  outline?: OutlineDraft;
  /** Phase 05 (additive, optional): graph-selected AI candidates (core llm/candidates.ts, worker only). */
  aiCandidates?: AiCandidate[];
  /** Phase 06 (additive): which adapter read the document (absent = html, the Phase 03 default). */
  source?: DocSource;
  /** Phase 06 (additive): page count for PDF / OCR sources. */
  pageCount?: number;
  /** Phase 06 (additive): 0-based PDF pages without a usable text layer (rendered and OCR'd). */
  scanPages?: number[];
  /** Phase 06 (additive): per-page OCR state for scanned pages. */
  ocr?: { pages: OcrPageView[] };
  /** Phase 06 (additive): DOCX list numbering was reconstructed (labelled in the views). */
  reconstructedNumbering?: boolean;
  /** Phase 06 (additive): one short plain-language notice about the read (DOCX loss, OCR gaps). */
  notice?: string;
  /** Intake Phase 2 (additive): primary facts; present only when `settings.packageFacts` was true. */
  packageFacts?: PrimaryFacts;
}

/** Intake Phase 2: light read of one package member. Code-only failure, never message or text. */
export type ReadPackageDocResponse =
  { ok: true; facts: PackageFacts } | { ok: false; code: string };

/** Phase 06: document source kinds. */
export type DocSource = 'html' | 'pdf' | 'docx' | 'ocr';

/** Phase 06: OCR state of one page. */
export type OcrPageState = 'queued' | 'running' | 'done' | 'failed' | 'unavailable';

export interface OcrPageView {
  /** 0-based page index. */
  index: number;
  state: OcrPageState;
  /** Page confidence (done pages only). */
  conf?: number;
  /** True when conf is below limits.ocrLowConfidence. */
  lowConfidence?: boolean;
  /** Short plain reason for failed / unavailable pages. */
  reason?: string;
}

/** Phase 06: one OCR page handed to the engine worker (lines only for done pages). */
export interface OcrPageInput {
  index: number;
  state: OcrPageState;
  lines?: OcrResult['pages'][number]['lines'];
  reason?: string;
}

/**
 * Phase 06 (D3): discriminated analyze input. A bare Uint8Array is still accepted as HTML (the
 * Phase 03 form) so existing callers are unchanged. `name` enables format detection (extension +
 * magic bytes) in the worker; a mismatch is refused.
 */
export type AnalyzeInput =
  | { kind: 'html'; bytes: Uint8Array; name?: string }
  | { kind: 'docx'; bytes: Uint8Array; name?: string }
  | { kind: 'pdf'; bytes: Uint8Array; name?: string; ocrPages?: OcrPageInput[] }
  | { kind: 'ocr'; sourceHash: string; pageCount: number; pages: OcrPageInput[]; bytes?: number };

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

/** Phase 07: one compare side on the wire (bytes copied, not transferred: both sides may be one file). */
export interface DiffSideInput {
  bytes: Uint8Array;
  /** Display / file name. Uploads pass it so the worker checks extension + magic bytes. */
  name?: string;
  /** Format hint, as for analyze (absent = from the name's extension, else html). */
  kind?: 'html' | 'pdf' | 'docx';
}

export interface DiffDocumentsInput {
  a: DiffSideInput;
  b: DiffSideInput;
  mode: DiffMode;
}

/**
 * Phase 07 outcome. `ms` is worker-measured (both prepares + diff) and lives OUTSIDE DiffResult
 * (determinism). The error carries side + stage + code only: never message or document text.
 */
export type DiffDocumentsResponse =
  | { result: DiffResult; ms: number }
  | { error: { side: 'a' | 'b'; stage: DiffStage; code: string } };

export interface EngineApi {
  analyze(
    input: AnalyzeInput | Uint8Array,
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
  /**
   * Phase 07: version / sibling diff of two documents. Both go through the same prepare helper as
   * analyze (format dispatch, parse, graph, deterministic checks). Never throws for a bad input.
   */
  diffDocuments(input: DiffDocumentsInput): Promise<DiffDocumentsResponse>;
  /**
   * Intake Phase 2: light read of one package member (read + structure only, core
   * buildPackageFacts). Never throws across Comlink.
   */
  readPackageDoc(input: AnalyzeInput, opts: { name: string }): Promise<ReadPackageDocResponse>;
}
