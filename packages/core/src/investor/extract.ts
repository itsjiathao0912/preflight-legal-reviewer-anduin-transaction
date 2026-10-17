import type { DocGraph } from '../graph/graph';
import type { OptionGroup } from '../structure/types';
import { classifyType, FAMILY, type InvestorTypeEntry, type InvestorTypeId } from './types';

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

type GroupOption = OptionGroup['options'][number];

/** A peer-item gap: `option` lacks footnote `marker` while >= 2 same-family `peers` carry it. */
export interface PeerMarkerGap {
  option: GroupOption;
  type: InvestorTypeId;
  marker: string;
  peers: InvestorTypeId[];
  /** The same-family options that carry `marker`. */
  carriers: GroupOption[];
}

/**
 * PATH-04 peer rule (shared by investor/paths.ts and footnote-requirement, Phase 06 D2): within a
 * family, >= 2 peers carry footnote m and this classified type does not. Families keep an
 * Individual (person) from ever being a peer of the entity types. Deterministic order: markers in
 * first-seen order, then families in first-seen carrier order, then options in group order.
 * `distinctPeers` (OCR relaxation in footnote-requirement only) requires >= 2 distinct peer types
 * and skips options whose own type is among the carriers.
 */
export function peerMarkerGaps(
  group: OptionGroup,
  opts: { distinctPeers?: boolean } = {},
): PeerMarkerGap[] {
  const typed = group.options
    .map((o) => ({ o, id: classifyType(cleanLabel(withoutMarker(o.label, o.footnote_marker))) }))
    .filter((x): x is { o: GroupOption; id: InvestorTypeId } => x.id !== null);
  const markers = [
    ...new Set(typed.map((x) => x.o.footnote_marker).filter((m): m is string => !!m)),
  ];
  const out: PeerMarkerGap[] = [];
  for (const m of markers) {
    const carriers = typed.filter((x) => x.o.footnote_marker === m);
    for (const fam of new Set(carriers.map((x) => FAMILY[x.id]))) {
      const famCarriers = carriers.filter((x) => FAMILY[x.id] === fam);
      const peers = famCarriers.map((x) => x.id);
      // distinctPeers: >= 2 DIFFERENT types must carry m (three plan labels that all classify as
      // one type are one peer, not three). PATH-04 keeps its original count (HTML unchanged).
      if ((opts.distinctPeers ? new Set(peers).size : peers.length) < 2) continue;
      for (const x of typed) {
        if (FAMILY[x.id] !== fam || x.o.footnote_marker) continue;
        // distinctPeers: a type that itself carries m on another option (KEOGH Plan is an `ira`
        // with footnote 2, Traditional IRA is not) is option-specific, not a type-level gap.
        if (opts.distinctPeers && peers.includes(x.id)) continue;
        out.push({
          option: x.o,
          type: x.id,
          marker: m,
          peers,
          carriers: famCarriers.map((c) => c.o),
        });
      }
    }
  }
  return out;
}
