import type { DocGraph } from '../graph/graph';
import type { OptionGroup } from '../structure/types';
import { classifyType, type InvestorTypeEntry } from './types';

/**
 * Investor-type extraction: option groups whose short labels classify into investor types.
 * A group qualifies when >= 2 options classify into >= 2 distinct types and at least 60% of its
 * options classify (accredited-investor sentence lists do not qualify: labels > 80 chars).
 * Types are the union over qualifying groups in document order (first occurrence wins).
 */
export const MIN_TYPED_OPTIONS = 2;
export const MIN_TYPED_SHARE = 0.6;

/** Label without a trailing footnote marker ("Corporation2" -> "Corporation"). */
export function withoutMarker(label: string, marker: string | undefined): string {
  return marker && label.endsWith(marker) ? label.slice(0, -marker.length).trim() : label;
}

export function isInvestorGroup(group: OptionGroup): boolean {
  const typed = group.options.map((o) =>
    classifyType(cleanLabel(withoutMarker(o.label, o.footnote_marker))),
  );
  const hits = typed.filter((t) => t !== null);
  if (hits.length < MIN_TYPED_OPTIONS) return false;
  if (new Set(hits).size < 2) return false;
  return hits.length / group.options.length >= MIN_TYPED_SHARE;
}

/** Strip trailing fill-in blanks and "(Specify)" so labels read cleanly. */
export function cleanLabel(label: string): string {
  return label
    .replace(/_{2,}.*$/, '')
    .replace(/\s*\((?:please\s+)?specify\)\s*$/i, '')
    .trim();
}

export function investorGroups(g: DocGraph): OptionGroup[] {
  return g.structure.optionGroups.filter(isInvestorGroup);
}

export function extractInvestorTypes(g: DocGraph): InvestorTypeEntry[] {
  const out: InvestorTypeEntry[] = [];
  for (const group of investorGroups(g)) {
    for (const o of group.options) {
      const label = cleanLabel(withoutMarker(o.label, o.footnote_marker));
      const id = classifyType(label);
      if (!id || out.some((t) => t.id === id)) continue;
      const entry: InvestorTypeEntry = { id, label: label.slice(0, 80), blockIndex: o.blockIndex };
      if (o.footnote_marker) entry.footnote = o.footnote_marker;
      out.push(entry);
    }
  }
  return out;
}
