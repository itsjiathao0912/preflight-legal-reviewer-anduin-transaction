import { annexLabels } from '../detectors/flow';
import { CARVE_OUT_RE } from '../detectors/undefined-term';
import type { DocGraph } from '../graph/graph';
import type { Block, Line } from '../model/types';
import { structure } from '../structure/structurer';
import type { Structure } from '../structure/types';
import { extractPackageDefinitions } from './definitions';
import { extractParts, partAt } from './parts';
import { blockTextOf } from './quote';
import { extractExternalReferences } from './references';
import { extractUsedTerms } from './terms';
import type { PackageDocFormat, PackageFacts, PrimaryFacts, SuppressedTerm } from './types';

/** Stage-1 light read caps. */
export const FACTS_LIMITS = Object.freeze({
  titleLines: 12,
  titleLineChars: 200,
  headTextChars: 1500,
  headings: 200,
  headingChars: 120,
});

export interface PackageFactsInput {
  contentHash: string;
  name: string;
  format: PackageDocFormat;
  bytes: number;
  lines: readonly Line[];
  needsOcr?: boolean;
}

/**
 * Light read of one package member: `structure()` only (no graph, no detectors). A structurer
 * exception gives empty facts (the file is then typed `other`, `low`); no lines means needs OCR.
 */
export function buildPackageFacts(input: PackageFactsInput): PackageFacts {
  const needsOcr = input.needsOcr === true || input.lines.every((l) => !l.text.trim());
  const base: PackageFacts = {
    contentHash: input.contentHash,
    name: input.name.slice(0, 255),
    format: input.format,
    bytes: input.bytes,
    needsOcr,
    titleLines: [],
    headText: '',
    headings: [],
    definitions: [],
  };
  if (needsOcr) return base;
  let s: Structure;
  try {
    s = structure(input.contentHash, [...input.lines]);
  } catch {
    return base;
  }
  const texts = input.lines.map((l) => l.text.trim()).filter((t) => t.length > 0);
  base.titleLines = texts
    .slice(0, FACTS_LIMITS.titleLines)
    .map((t) => t.slice(0, FACTS_LIMITS.titleLineChars));
  base.headText = texts.join('\n').slice(0, FACTS_LIMITS.headTextChars);
  base.headings = s.blocks
    .filter((b) => b.kind === 'heading')
    .slice(0, FACTS_LIMITS.headings)
    .map((b) => blockTextOf(b).trim().slice(0, FACTS_LIMITS.headingChars));
  const parts = extractParts(s.blocks);
  base.parts = parts;
  base.definitions = extractPackageDefinitions(input.contentHash, s.blocks).map((d) => {
    const at = partAt(s.blocks, parts, d.location.blockIndex);
    return at ? { ...d, ...at } : d;
  });
  return base;
}

/** Section, annex and appendix labels of a document ("Section 4", "Annex A", "Appendix B"). */
export function scopeLabelsOf(s: Structure): string[] {
  const out = new Set<string>();
  for (const sc of s.scopes) {
    for (const sec of sc.sections) out.add(`Section ${sec.number}`);
    const m = /^\s*(Appendix|Schedule|Exhibit)\s{1,4}([A-Z]|\d{1,2})\b/i.exec(sc.title);
    if (m)
      out.add(`${m[1]![0]!.toUpperCase()}${m[1]!.slice(1).toLowerCase()} ${m[2]!.toUpperCase()}`);
  }
  for (const l of annexLabels(s.blocks)) out.add(`Annex ${l}`);
  for (const b of s.blocks) {
    const m = /^\s{0,4}(Schedule|Exhibit|Appendix)\s{1,4}([A-Z]|\d{1,2})(?![A-Za-z0-9])/.exec(
      b.lines[0]?.text ?? '',
    );
    if (m && b.kind === 'heading') out.add(`${m[1]} ${m[2]}`);
  }
  return [...out].sort();
}

/** Facts of the to-digitize document graph (stage 2): references, used terms, carve-out. */
export function extractPrimaryFacts(
  g: DocGraph,
  docId: string,
  suppressed: readonly SuppressedTerm[] = [],
): PrimaryFacts {
  const s = g.structure;
  const scopeLabels = scopeLabelsOf(s);
  const { references, dropped } = extractExternalReferences(s.blocks, { docId, scopeLabels });
  const localTerms = [...new Set(s.definedTerms.map((t) => t.term))].sort();
  let carveOutTarget: string | null = null;
  for (const b of s.blocks) {
    const m = CARVE_OUT_RE.exec(blockTextOf(b));
    if (m) {
      carveOutTarget = m[1]!;
      break;
    }
  }
  return {
    docId,
    references,
    dropped,
    usedTerms: extractUsedTerms(s.blocks, localTerms),
    carveOutTarget,
    localTerms,
    scopeLabels,
    suppressed: [...suppressed],
  };
}

/** Source File viewer: the blocks of one package member, indexed exactly like its facts. */
export interface PackageViewBlock {
  id: string;
  kind: Block['kind'];
  text: string;
  section: string | null;
}

export function packageViewBlocks(contentHash: string, lines: readonly Line[]): PackageViewBlock[] {
  return structure(contentHash, [...lines]).blocks.map((b) => ({
    id: b.id,
    kind: b.kind,
    text: blockTextOf(b),
    section: b.section_path[0] ?? null,
  }));
}
