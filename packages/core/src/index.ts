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
