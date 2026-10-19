import { family } from '../detectors/undefined-term';
import type { Finding } from '../findings/schema';
import type { Block } from '../model/types';
import { definitionLocationOf } from './parts';
import { blockTextOf, locationOf } from './quote';
import type {
  CrossDocDefinition,
  CrossDocTerm,
  PackageDocument,
  PrimaryFacts,
  SuppressedTerm,
  UsedTerm,
} from './types';

/** Capitalized terms that are structure words or proper names, never "defined terms". */
export const USED_TERM_STOPLIST: readonly string[] = Object.freeze([
  'Section',
  'Article',
  'Part',
  'Annex',
  'Schedule',
  'Exhibit',
  'Appendix',
  'Agreement',
  'Subscription Agreement',
  'Form',
  'Item',
  'Page',
  'Question',
  'United States',
  'U.S.',
  'Act',
  'Code',
  'Rule',
  'Regulation',
  'Securities Act',
  'Investment Company Act',
  'Exchange Act',
  'ERISA',
  'IRS',
  'SEC',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);
const STOP = new Set(USED_TERM_STOPLIST);
const STOP_HEAD = new Set([
  'Section',
  'Article',
  'Part',
  'Annex',
  'Schedule',
  'Exhibit',
  'Appendix',
  'Form',
  'Question',
  'Item',
  'Rule',
]);
export const MAX_USED_TERMS = 200;

/**
 * A capitalized 1-4 word run used mid-sentence after a determiner ("the Capital Commitment",
 * "any Excused Investor"). The determiner narrows the scan to term-like uses (place names and
 * headings are rarely preceded by one).
 */
export const USED_TERM_RE =
  /(?<=\b(?:the|a|an|any|each|such|its|their|no|every|all|other|per|that|which)\s)([A-Z][a-z][A-Za-z-]{0,28}(?:\s[A-Z][a-z][A-Za-z-]{0,28}){0,3})(?![A-Za-z’'])/g;
/** Last words that name a document or statute, not a defined term. */
export const DOCUMENT_TAIL_WORDS: readonly string[] = Object.freeze([
  'Agreement',
  'Agreements',
  'Memorandum',
  'Prospectus',
  'Letter',
  'Letters',
  'Act',
  'Code',
  'Form',
  'Forms',
]);
const TAIL = new Set(DOCUMENT_TAIL_WORDS);

function normTerm(t: string): string {
  return t.toLowerCase();
}

const isWordChar = (c: string | undefined): boolean => c !== undefined && /\w/.test(c);

/**
 * Which of `terms` (lower case) occur in `text` with word boundaries on both sides, the same test
 * as `new RegExp(\`\\b${term}\\b\`)` per term, in one pass over the word starts of `text`.
 */
function lowerUsedTerms(text: string, terms: readonly string[]): Set<string> {
  const byHead = new Map<string, string[]>();
  for (const t of new Set(terms)) {
    const head = /^\w+/.exec(t)?.[0];
    if (!head) continue;
    const list = byHead.get(head);
    if (list) list.push(t);
    else byHead.set(head, [t]);
  }
  const found = new Set<string>();
  let pending = byHead.size;
  for (const m of text.matchAll(/\w+/g)) {
    if (pending === 0) break;
    const list = byHead.get(m[0]);
    if (!list) continue;
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i]!;
      const end = m.index + t.length;
      if (text.startsWith(t, m.index) && isWordChar(t.at(-1)) !== isWordChar(text[end])) {
        found.add(t);
        list.splice(i, 1);
      }
    }
    if (list.length === 0) {
      byHead.delete(m[0]);
      pending--;
    }
  }
  return found;
}

/** Terms used mid-sentence at least twice and not defined locally (bounded to 200 terms). */
export function extractUsedTerms(
  blocks: readonly Block[],
  localTerms: readonly string[],
): UsedTerm[] {
  const local = new Set(localTerms.map(normTerm));
  const acc = new Map<string, UsedTerm>();
  blocks.forEach((b, bi) => {
    const text = blockTextOf(b);
    for (const m of text.matchAll(USED_TERM_RE)) {
      const term = m[1]!;
      const words = term.split(' ');
      if (
        STOP.has(term) ||
        STOP_HEAD.has(words[0]!) ||
        TAIL.has(words.at(-1)!) ||
        local.has(normTerm(term))
      )
        continue;
      const hit = acc.get(term);
      if (hit) hit.mentions++;
      else if (acc.size < MAX_USED_TERMS * 4)
        acc.set(term, {
          term,
          mentions: 1,
          firstLocation: locationOf(b, bi, m.index, m.index + term.length),
        });
    }
  });
  // a term the document also writes in lower case is a common noun, not a defined term
  const all = blocks.map((b) => blockTextOf(b)).join('\n');
  const lower = lowerUsedTerms(
    all,
    [...acc.values()].filter((t) => t.mentions >= 2).map((t) => t.term.toLowerCase()),
  );
  return [...acc.values()]
    .filter((t) => t.mentions >= 2 && !lower.has(t.term.toLowerCase()))
    .sort(
      (a, b) =>
        a.firstLocation.blockIndex - b.firstLocation.blockIndex ||
        a.firstLocation.start - b.firstLocation.start,
    )
    .slice(0, MAX_USED_TERMS);
}

/** Documents whose definitions count: role `reference`, type `lpa` or `ppm`, readable. */
export function definitionSources(docs: readonly PackageDocument[]): PackageDocument[] {
  return docs.filter(
    (d) => d.role === 'reference' && (d.type === 'lpa' || d.type === 'ppm') && !d.needsOcr,
  );
}

function termMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase() || family(a) === family(b);
}

/**
 * Remove offering-noun `undefined-term` findings whose term the package defines (AC-I14).
 * Other findings are never touched; order is stable.
 */
export function applyPackageDefinitions(
  findings: readonly Finding[],
  defs: readonly CrossDocDefinition[],
): { findings: Finding[]; suppressed: SuppressedTerm[] } {
  const kept: Finding[] = [];
  const suppressed: SuppressedTerm[] = [];
  for (const f of findings) {
    const used = f.detector_id === 'undefined-term' ? f.detail.facts.used_term : undefined;
    const def = typeof used === 'string' ? defs.find((d) => termMatch(d.term, used)) : undefined;
    if (!def) {
      kept.push(f);
      continue;
    }
    suppressed.push({
      term: String(used),
      findingId: f.id,
      definingDocId: def.docId,
      quote: def.quote,
      definitionLocation: definitionLocationOf(def),
    });
  }
  return { findings: kept, suppressed };
}

/**
 * Cross-document term list (AC-I14/I16). Terms are listed only when the sub agreement says
 * terms are defined elsewhere (carve-out); suppressed offering nouns are always listed as
 * defined in the package. These lists never produce findings.
 */
export function buildCrossDocTerms(
  primary: PrimaryFacts | null,
  defs: readonly CrossDocDefinition[],
  hasDefinitionDoc: boolean,
): CrossDocTerm[] {
  if (!primary) return [];
  const out = new Map<string, CrossDocTerm>();
  for (const s of primary.suppressed)
    out.set(s.term, {
      term: s.term,
      status: 'defined_in_package',
      mentions: 1,
      definingDocId: s.definingDocId,
      quote: s.quote,
      ...(s.definitionLocation ? { definitionLocation: s.definitionLocation } : {}),
    });
  if (primary.carveOutTarget) {
    for (const u of primary.usedTerms) {
      if (out.has(u.term)) continue;
      const def = defs.find((d) => termMatch(d.term, u.term));
      out.set(
        u.term,
        def
          ? {
              term: u.term,
              status: 'defined_in_package',
              mentions: u.mentions,
              definingDocId: def.docId,
              quote: def.quote,
              definitionLocation: definitionLocationOf(def),
            }
          : {
              term: u.term,
              status: 'unverified',
              mentions: u.mentions,
              reason: hasDefinitionDoc ? 'not_in_reference_documents' : 'no_reference_document',
            },
      );
    }
  }
  return [...out.values()].sort((a, b) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0));
}
