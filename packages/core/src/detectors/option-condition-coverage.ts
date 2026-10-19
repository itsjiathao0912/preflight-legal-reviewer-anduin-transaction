import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { cleanLabel, isInvestorGroup, withoutMarker } from '../investor/extract';
import { classifyType, typesIn } from '../investor/types';
import type { Conditional, OptionGroup, OptionItem } from '../structure/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, maskFacts, maskThenClip, textOf, whereOf } from './util';

/**
 * option-condition-coverage (high): an exclusive investor-type option joins two types
 * ("Partnership or LLC") but the conditional right after the group names only one of them
 * ("If the Investor is a trust, corporation or partnership, also complete Section 3"), so the
 * route for the unnamed type is unclear. Word-level only; unnamed or single-type options
 * (Individual, IRA) are never flagged. Precision first: when unsure, do not flag.
 */
export const OPTION_CONDITION_COVERAGE_ID = 'option-condition-coverage';

/** Conditionals within this many blocks after the group's last block are "adjacent". */
export const COVERAGE_WINDOW = 3;

const PART_SPLIT_RE = /\s*(?:\bor\b|\/|,)\s*/i;

/** Lowercase, letters only, light plural folding ("partnerships" -> "partnership", "LLCs" -> "llc"). */
function norm(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
}

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .split(/[^A-Za-z]+/)
      .filter(Boolean)
      .map(norm),
  );
}

function headWord(part: string): string {
  return norm(part.trim().split(/\s+/)[0] ?? '');
}

interface Coverage {
  opt: OptionItem;
  label: string;
  named: string[];
  unnamed: string[];
}

export function partialCoverage(label: string, trigger: string): Omit<Coverage, 'opt'> | null {
  const parts = label
    .split(PART_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const words = wordsOf(trigger);
  const named: string[] = [];
  const unnamed: string[] = [];
  for (const p of parts) {
    const h = headWord(p);
    if (h && words.has(h)) named.push(p);
    else if (classifyType(p) !== null) unnamed.push(p);
  }
  if (!named.length || !unnamed.length) return null;
  return { label, named, unnamed };
}

function sectionOf(g: DocGraph, blockIndex: number): string | undefined {
  return g.structure.info[blockIndex]?.section?.number;
}

function candidates(g: DocGraph, group: OptionGroup): Conditional[] {
  const first = Math.min(...group.blockIndices);
  const last = Math.max(...group.blockIndices);
  const sec = sectionOf(g, last);
  return g.structure.conditionals.filter(
    (c) =>
      c.blockIndex >= first &&
      c.blockIndex <= last + COVERAGE_WINDOW &&
      !c.negative &&
      sectionOf(g, c.blockIndex) === sec &&
      typesIn(c.trigger).length >= 1,
  );
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function explain(f: ExplainFacts): string {
  const unnamed = fact(f, 'unnamed', 'the other type');
  return `In ${fact(f, 'where', 'the document')} the option "${fact(f, 'option', 'this option')}" is only partly covered by "${fact(f, 'condition', 'the instruction')}": it names ${fact(f, 'named', 'one type')} but not ${unnamed}, so it is unclear whether ${unnamed} investors follow that instruction.`;
}

export const optionConditionCoverage: Detector = {
  id: OPTION_CONDITION_COVERAGE_ID,
  class: 'option_gap_overlap',
  severity: 'high',
  explain,
  patternKey: () => patternKey(OPTION_CONDITION_COVERAGE_ID, 'partial-named'),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    for (const group of g.structure.optionGroups) {
      if (!group.exclusive || !group.blockIndices.length || !isInvestorGroup(group)) continue;
      for (const c of candidates(g, group)) {
        let hit: Coverage | null = null;
        for (const opt of group.options) {
          const label = cleanLabel(withoutMarker(opt.label, opt.footnote_marker));
          const cov = partialCoverage(label, c.trigger);
          if (cov) {
            hit = { opt, ...cov };
            break;
          }
        }
        if (!hit) continue;
        const text = textOf(g, hit.opt.blockIndex);
        const idx = text.indexOf(hit.label);
        const at = Math.max(0, idx);
        const len = idx >= 0 ? hit.label.length : Math.min(hit.label.length, text.length);
        const target = c.targets.length ? c.targets.join(', ') : 'the referenced section';
        const named = hit.named.join(', ');
        const unnamed = hit.unnamed.join(', ');
        const facts = maskFacts({
          option: maskThenClip(hit.label, 120),
          named,
          unnamed,
          condition: maskThenClip(c.text, 200),
          target,
          where: whereOf(g, hit.opt.blockIndex),
          counsel_question: `Should ${unnamed} investors complete ${target}?`,
        });
        const u = fact(facts, 'unnamed', 'these');
        const t = fact(facts, 'target', 'the referenced section');
        out.push(
          buildFinding(g, {
            detectorId: OPTION_CONDITION_COVERAGE_ID,
            issueClass: 'option_gap_overlap',
            severity: 'high',
            confidence: 0.7,
            blockIndex: hit.opt.blockIndex,
            matchStart: at,
            matchEnd: at + len,
            explanation: explain(facts),
            facts,
            expected: 'A conditional that names every type in the option, or split options',
            interpretations: [
              `${cap(u)} investors also complete ${t}.`,
              `${cap(u)} investors do not complete ${t}; only ${fact(facts, 'named', 'the named')} investors do.`,
              'The option should be split so each type has its own route.',
            ],
            patternKey: optionConditionCoverage.patternKey(facts),
          }),
        );
      }
    }
    return out;
  },
};
