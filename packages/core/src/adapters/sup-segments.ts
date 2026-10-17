import type { Line } from '../model/types';

/** A superscript (footnote marker) segment inside a Line's text: [start, end) + the marker text. */
export interface SupSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * TS-only side channel (E5, Phase 06 D2): superscript segments per emitted Line object. Not part
 * of LineSchema / Cue (contracts snapshot unchanged) and the line text itself is untouched. The
 * structurer keeps the same Line object in block.lines[0], so structure/option-groups.ts can read
 * it back. Shared by the HTML adapter (<sup>) and the OCR adapter (`^{n}` markers). This is the
 * ONLY map: html.ts re-exports supSegmentsOf.
 */
const SUP_SEGMENTS = new WeakMap<Line, readonly SupSegment[]>();

/** Superscript segments recorded for a Line (empty for any Line without them). */
export function supSegmentsOf(line: Line | undefined): readonly SupSegment[] {
  return (line && SUP_SEGMENTS.get(line)) ?? [];
}

/** Record superscript segments for an emitted Line (an empty list records nothing). */
export function setSupSegments(line: Line, segments: readonly SupSegment[]): void {
  if (segments.length) SUP_SEGMENTS.set(line, segments);
}
