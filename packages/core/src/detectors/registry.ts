import type { DocGraph } from '../graph/graph';
import type { Finding } from '../findings/schema';
import type { Severity } from '../findings/severity';
import type { IssueClass } from '../findings/taxonomy';
import { refThisSection } from './ref-this-section';
import { refLabelCoherence } from './ref-label-coherence';
import { undefinedTerm } from './undefined-term';
// -- Phase 02 imports (append) --
import { brokenConditional } from './broken-conditional';
import { unreachableFlow } from './unreachable-flow';
import { optionGapOverlap } from './option-gap-overlap';
import { definedTermIssues } from './defined-term-issues';
import { footnoteRequirement } from './footnote-requirement';
import { flagDraftingNote } from './flag-drafting-note';
import { flagPlaceholder } from './flag-placeholder';
import { flagSensitive } from './flag-sensitive';
import { investorPathDeadEnd } from './investor-path-dead-end';
import { investorPathMissingItem } from './investor-path-missing-item';

/** Facts a detector uses to explain a finding (AC9). */
export type ExplainFacts = Record<string, string | number | boolean | null>;

export interface Detector {
  id: string;
  class: IssueClass;
  /** Maximum severity this rule emits. */
  severity: Severity;
  /** Plain-language rule + facts used. */
  explain(facts: ExplainFacts): string;
  /** Deterministic pattern signature for rule proposals (no numbers). */
  patternKey(facts: ExplainFacts): string;
  run(g: DocGraph): Finding[];
}

/**
 * Detector registry. APPEND-ONLY seam: later phases add registrations at the end;
 * existing entries are never rewritten or reordered.
 */
export const detectors: readonly Detector[] = [
  refThisSection,
  refLabelCoherence,
  undefinedTerm,
  // -- append below (Phase 02+) --
  brokenConditional,
  unreachableFlow,
  optionGapOverlap,
  definedTermIssues,
  footnoteRequirement,
  flagDraftingNote,
  flagPlaceholder,
  flagSensitive,
  investorPathDeadEnd,
  investorPathMissingItem,
];

export function detectorById(id: string): Detector | undefined {
  return detectors.find((d) => d.id === id);
}
