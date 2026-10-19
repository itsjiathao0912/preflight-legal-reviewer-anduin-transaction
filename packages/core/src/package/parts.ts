import type { Block } from '../model/types';
import { blockTextOf } from './quote';
import type {
  CrossDocDefinition,
  DefinitionLocation,
  PackagePart,
  PackageFacts,
  RawReference,
} from './types';

/**
 * Source File traceability (pure, linear, bounded). Numbered parts of a package document and the
 * part a sub doc cites ("Section 3.2 of the Partnership Agreement"). Precision first: a decimal
 * label N.M counts only when a block starts with it, and a label that occurs twice is dropped.
 */
export const MAX_PARTS = 400;

/** "3.2 Permitted Uses", "Section 3.2 Permitted Uses" (title must start upper case). */
const DECIMAL_PART_RE =
  /^\s{0,4}(?:Section\s{1,2})?(\d{1,4}[A-Z]?\.\d{1,3})(?![\d.]\d)\.?\s{1,4}([A-Z][^\n]{0,200})/;
/** "Section 7 Transfers" / "Section 7. Transfers" (whole section, no decimal). */
const SECTION_PART_RE =
  /^\s{0,4}Section\s{1,2}(\d{1,4}[A-Z]?)(?![\d.]\d)\.?\s{1,4}([A-Z][^\n]{0,200})/;

function titleOf(rest: string): string {
  const cut = /[.;:](?:\s|$)/.exec(rest);
  return (cut ? rest.slice(0, cut.index) : rest).trim().slice(0, 80);
}

/** Unique numbered parts of a document, in document order (at most MAX_PARTS). */
export function extractParts(blocks: readonly Block[]): PackagePart[] {
  const all: PackagePart[] = [];
  const count = new Map<string, number>();
  blocks.forEach((b, blockIndex) => {
    const text = blockTextOf(b).slice(0, 260);
    const m = DECIMAL_PART_RE.exec(text) ?? SECTION_PART_RE.exec(text);
    if (!m) return;
    const label = m[1]!;
    count.set(label, (count.get(label) ?? 0) + 1);
    all.push({ label, title: titleOf(m[2]!), blockIndex });
  });
  return all.filter((p) => count.get(p.label) === 1).slice(0, MAX_PARTS);
}

/**
 * Label and paragraph of the part that holds `blockIndex`: the nearest part at or before it, only
 * when no heading block sits between them (a new heading ends the part).
 */
export function partAt(
  blocks: readonly Pick<Block, 'kind'>[],
  parts: readonly PackagePart[],
  blockIndex: number,
): { sectionLabel: string; paragraph: number } | null {
  let best: PackagePart | null = null;
  for (const p of parts) if (p.blockIndex <= blockIndex) best = p;
  if (!best) return null;
  for (let k = best.blockIndex + 1; k <= blockIndex; k++)
    if (blocks[k]?.kind === 'heading') return null;
  return { sectionLabel: best.label, paragraph: blockIndex - best.blockIndex + 1 };
}

/** The definition location carried by a cross-document term (additive contract field). */
export function definitionLocationOf(d: CrossDocDefinition): DefinitionLocation {
  const loc: DefinitionLocation = {
    blockIndex: d.location.blockIndex,
    sectionPath: [...d.location.sectionPath],
  };
  if (d.sectionLabel) loc.sectionLabel = d.sectionLabel;
  if (d.paragraph) loc.paragraph = d.paragraph;
  return loc;
}

/** "Section 3.2 of the " right before the target label (the label must occur once in the quote). */
const CITE_BEFORE_RE =
  /(?:\bSections?|§)\s{0,2}(\d{1,4}[A-Z]?(?:\.\d{1,3})?)\s{1,2}of\s{1,2}(?:the\s{1,2})?$/;

/** The part label a reference cites in front of the document name, or null. */
export function citedPartLabel(r: Pick<RawReference, 'quote' | 'targetLabel'>): string | null {
  const re = new RegExp(
    `(?<![A-Za-z0-9])${r.targetLabel
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s{1,2}')}(?![A-Za-z0-9])`,
    'g',
  );
  const hits = [...r.quote.matchAll(re)];
  if (hits.length !== 1) return null;
  const at = hits[0]!.index;
  const m = CITE_BEFORE_RE.exec(r.quote.slice(Math.max(0, at - 40), at));
  return m ? m[1]! : null;
}

/** The cited part of the resolved document when that exact label exists there; else undefined. */
export function resolvedPartOf(
  r: Pick<RawReference, 'quote' | 'targetLabel'>,
  facts: Pick<PackageFacts, 'parts'> | undefined,
): PackagePart | undefined {
  const label = citedPartLabel(r);
  if (!label) return undefined;
  const p = facts?.parts?.find((x) => x.label === label);
  return p ? { ...p } : undefined;
}
