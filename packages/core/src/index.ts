// @aduin/core public barrel. Append-only: each phase adds export lines here
// (seam file; edits are serialized by the orchestrator).
export const CORE_PACKAGE = '@aduin/core' as const;

// --- Phase 01: core engine, memory core, contracts v1 ---
export * from './model/types';
export { makeAnchor, anchorId } from './model/anchors';
export { collectLines, isCaps } from './model/line-stream';
export { sha256Hex } from './model/hash';
export { CoreError } from './model/errors';
export { limits, type Limits } from './config/limits';
export {
  htmlToLines,
  remapCp1252,
  styleWeight,
  GLYPH_RULES,
  NOISE_RULES,
  EXCLUSIVITY_CUES,
  type HtmlAdapterResult,
  type NoiseRemoval,
} from './adapters/html';
export { structure } from './structure/structurer';
export type * from './structure/types';
export { buildGraph, nodeId, type DocGraph } from './graph/graph';
export * as graphQuery from './graph/query';
export * from './findings/taxonomy';
export * from './findings/severity';
export * from './findings/schema';
export { findingId, compareFindings } from './findings/ids';
export { buildFinding, patternKey, type FindingInput } from './findings/make-finding';
export { detectors, detectorById, type Detector, type ExplainFacts } from './detectors/registry';
export { LABEL_COHERENCE, scoreReference } from './detectors/ref-label-coherence';
export { analyzeHtml, buildDocGraph, runDeterministic, type EngineSettings } from './engine';
export * from './memory/index';
export {
  signCookie,
  verifyCookie,
  b64urlEncode,
  b64urlDecode,
  type KeyMap,
  type KeyMaterial,
  type VerifyResult,
} from './session/cookie';
export * from './contracts/errors';
export * from './contracts/claims';
export * from './contracts/frames';
export * from './contracts/cache-key';
export * from './contracts/ai';
export * from './contracts/ocr';
export * from './contracts/quota';
export * from './contracts/memory';
export type * from './contracts/ports';
export * from './contracts/seed-spec';

// --- Phase 02: structure view model (built in the engine worker; main thread imports types only) ---
export {
  buildStructureView,
  LENS_IDS,
  type LensId,
  type StructureView,
  type SectionRow,
  type CrossrefRow,
  type ExternalRow,
  type ConditionRow,
  type ConditionKind,
  type OptionRow,
  type TermRow,
  type TermStatus,
  type RefStatus,
  type InvestorView,
  type InvestorTypeRow,
  type InvestorGapRow,
} from './structure-view/build';

// --- Phase 05: LLM task framework (tasks registry, rules injection, verify chain, candidates) ---
export * from './llm/index';

// --- Phase 06 (06d): PDF / OCR / format detection / page noise adapters ---
// DOCX is NOT re-exported here: mammoth is CommonJS and cannot be tree-shaken, so a barrel
// re-export adds ~690 KB to the apps/worker bundle (wrangler dry-run, 06d). Import DOCX from the
// `@aduin/core/docx` subpath instead. pdf.ts loads unpdf lazily and tree-shakes out of the worker.
export {
  pdfToLines,
  PDF_MESSAGES,
  type PdfAdapterOptions,
  type PdfAdapterResult,
} from './adapters/pdf';
export {
  pdfPagesToLines,
  MIN_TEXT_CHARS,
  type PdfTextItem,
  type PdfTextPage,
  type PdfPageLines,
  type PdfLinesResult,
} from './adapters/pdf-text';
export {
  ocrToLines,
  stripMarkers,
  normalizeRegion,
  OCR_MAX_LINES_PER_PAGE,
  type OcrPage,
  type OcrPageLines,
  type OcrLinesResult,
} from './adapters/ocr';
export {
  pageConfidence,
  structuralScore,
  isLowConfidence,
  DEFAULT_SELF_REPORTED,
} from './ocr/confidence';
export {
  detectFormat,
  sniffMagic,
  type DocFormat,
  type FormatDetection,
} from './adapters/format-detect';
export {
  stripPageNoise,
  isPageNumberLine,
  type DroppedLine,
  type NoiseRule,
  type PageNoiseResult,
} from './adapters/page-noise';
export { setSupSegments, supSegmentsOf, type SupSegment } from './adapters/sup-segments';
