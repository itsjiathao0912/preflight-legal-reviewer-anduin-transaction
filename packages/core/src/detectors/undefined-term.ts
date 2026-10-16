import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import type { Detector, ExplainFacts } from './registry';

/**
 * U. undefined-term (AC13): an offering-security noun used in an offering context that
 * differs from the single defined offering term and is not itself defined.
 * Initial values (pinned; final values recorded in the Phase 01 report).
 */
export const OFFERING_NOUNS: readonly string[] = Object.freeze([
  'Units',
  'Unit',
  'Interests',
  'Interest',
  'Stock',
  'Common Stock',
  'Shares',
  'Share',
  'Securities',
]);
export const OFFERING_CONTEXT_RE =
  /\b(offered|offering of|purchase of|subscribed for|subscribe for|purchase)\s+(?:the\s+)?(Units|Interests|Stock)\b/g;
export const CARVE_OUT_RE =
  /not defined herein[^.]{0,80}?meanings?\s+(?:given|ascribed|assigned)\s+to\s+them\s+in\s+the\s+([A-Z][A-Za-z]{1,20}(?:\s[A-Z][A-Za-z]{1,20}){0,3})/;
export const UNDEFINED_TERM_ID = 'undefined-term';

/** Family key: singular, lowercase ("Shares" / "Share" -> "share"; "Common Stock" -> "stock"). */
export function family(term: string): string {
  const t = term.toLowerCase().replace(/^common\s+/, '');
  if (t === 'securities') return 'security';
  return t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
}

function explain(f: ExplainFacts): string {
  const base = `"${f.used_term}" is used for the offered security (${f.contexts} place(s)), but the document defines the offered security as "${f.defined_term}" and never defines "${f.used_term}".`;
  return f.carve_out
    ? `${base} The document says undefined terms take their meaning from the ${f.carve_out}, so it may be defined there.`
    : base;
}

export const undefinedTerm: Detector = {
  id: UNDEFINED_TERM_ID,
  class: 'defined_term_issue',
  severity: 'medium',
  explain,
  patternKey: (f) =>
    patternKey(
      UNDEFINED_TERM_ID,
      `${family(String(f.used_term))}s->${family(String(f.defined_term))}s`,
    ),
  run(g: DocGraph): Finding[] {
    const s = g.structure;
    const definedFamilies = new Set(s.definedTerms.map((t) => family(t.term)));
    const offering = new Map<string, string>();
    for (const t of s.definedTerms)
      if (OFFERING_NOUNS.includes(t.term)) offering.set(family(t.term), t.term);
    if (offering.size !== 1) return [];
    const [definedFamily, definedTerm] = [...offering.entries()][0]!;
    let carveOut: string | null = null;
    for (const b of s.blocks) {
      const m = CARVE_OUT_RE.exec(b.lines.map((l) => l.text).join(' '));
      if (m) {
        carveOut = m[1]!.trim();
        break;
      }
    }
    const hits = new Map<
      string,
      Array<{ blockIndex: number; start: number; end: number; text: string }>
    >();
    s.blocks.forEach((b, bi) => {
      const text = b.lines.map((l) => l.text).join(' ');
      for (const m of text.matchAll(OFFERING_CONTEXT_RE)) {
        const used = m[2]!;
        if (family(used) === definedFamily || definedFamilies.has(family(used))) continue;
        const list = hits.get(used) ?? [];
        list.push({ blockIndex: bi, start: m.index!, end: m.index! + m[0].length, text: m[0] });
        hits.set(used, list);
      }
    });
    const out: Finding[] = [];
    for (const [used, list] of [...hits.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const first = list[0]!;
      const facts: ExplainFacts = {
        used_term: used,
        defined_term: definedTerm,
        contexts: list.length,
        first_context: first.text,
        carve_out: carveOut,
      };
      const interpretations = carveOut
        ? [
            `"${used}" is defined in the external ${carveOut}, so the usage is correct.`,
            `"${used}" is a drafting leftover from a different product; it should read "${definedTerm}".`,
          ]
        : [
            `"${used}" should read "${definedTerm}".`,
            `"${used}" is a different security that needs its own definition.`,
          ];
      out.push(
        buildFinding(g, {
          detectorId: UNDEFINED_TERM_ID,
          issueClass: 'defined_term_issue',
          severity: 'medium',
          confidence: carveOut ? 0.6 : 0.75,
          blockIndex: first.blockIndex,
          matchStart: first.start,
          matchEnd: first.end,
          explanation: explain(facts),
          facts,
          interpretations,
          expected: `"${definedTerm}"`,
          patternKey: undefinedTerm.patternKey(facts),
        }),
      );
    }
    return out;
  },
};
