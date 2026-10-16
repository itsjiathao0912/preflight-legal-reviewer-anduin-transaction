import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import type { OptionGroup } from '../structure/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, maskFacts, textOf, whereOf } from './util';

/**
 * option-gap-overlap (high): exclusivity vs structure in option groups.
 *  - numeric range options ("$0 to $100,000", "Over $250,000") that leave a gap or overlap
 *  - an exclusive group ("check one") that offers "All of the above" / "Both"
 * Groups whose options are not ALL parseable ranges are ignored (uncertain, never asserted).
 */
export const OPTION_GAP_OVERLAP_ID = 'option-gap-overlap';

const NUM = String.raw`\$?\s?(\d{1,3}(?:,\d{3}){0,4}(?:\.\d{1,2})?|\d{1,12}(?:\.\d{1,2})?)`;
/** Each bounded; anchored at label start; a short tail (<= 24 chars) is allowed. */
export const RANGE_BETWEEN_RE = new RegExp(
  String.raw`^(?:between\s+)?${NUM}\s{0,3}(?:-|–|—|to|and)\s{0,3}${NUM}\s{0,3}[^\d]{0,24}$`,
  'i',
);
export const RANGE_BELOW_RE = new RegExp(
  String.raw`^(?:less than|under|below|up to)\s+${NUM}\s{0,3}[^\d]{0,24}$|^${NUM}\s+or less\b[^\d]{0,24}$`,
  'i',
);
export const RANGE_ABOVE_RE = new RegExp(
  String.raw`^(?:over|more than|greater than|above|in excess of)\s+${NUM}\s{0,3}[^\d]{0,24}$|^${NUM}\s{0,2}(?:\+|or more\b|and over\b|and above\b)[^\d]{0,24}$`,
  'i',
);
export const ALL_ABOVE_RE = /^(?:all of the above|both of the above|both)\b/i;

export interface Range {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
  label: string;
}

const n = (s: string) => Number(s.replace(/[,$\s]/g, ''));

export function parseRange(label: string): Range | null {
  const l = label.trim();
  let m = RANGE_BETWEEN_RE.exec(l);
  if (m) return { lo: n(m[1]!), hi: n(m[2]!), loOpen: false, hiOpen: false, label: l };
  m = RANGE_BELOW_RE.exec(l);
  if (m) {
    const v = n(m[1] ?? m[2]!);
    return { lo: 0, hi: v, loOpen: false, hiOpen: !/up to|or less/i.test(l), label: l };
  }
  m = RANGE_ABOVE_RE.exec(l);
  if (m) {
    const v = n(m[1] ?? m[2]!);
    return {
      lo: v,
      hi: Infinity,
      loOpen: !/or more|\+|and above/i.test(l),
      hiOpen: true,
      label: l,
    };
  }
  return null;
}

export interface GapOverlap {
  kind: 'gap' | 'overlap';
  first: string;
  second: string;
}

/** Sorted-range check: overlap when ranges share values, gap when a whole unit is left out. */
export function rangeIssues(ranges: Range[]): GapOverlap[] {
  const sorted = [...ranges].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  const out: GapOverlap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    const touch = b.lo === a.hi;
    if (b.lo < a.hi || (touch && !a.hiOpen && !b.loOpen)) {
      out.push({ kind: 'overlap', first: a.label, second: b.label });
    } else if (b.lo > a.hi) {
      const step = Number.isInteger(a.hi) && Number.isInteger(b.lo) ? 1 : 0.01;
      if (b.lo - a.hi > step + 1e-9) out.push({ kind: 'gap', first: a.label, second: b.label });
    }
  }
  return out;
}

function explain(f: ExplainFacts): string {
  if (f.kind === 'all-of-above')
    return `The option group in ${fact(f, 'where', 'the document')} says "${fact(f, 'cue', 'check one')}" but offers "${fact(f, 'second', 'all of the above')}", which overlaps every other option.`;
  return `In ${fact(f, 'where', 'the document')} the options "${fact(f, 'first', 'one option')}" and "${fact(f, 'second', 'the next option')}" ${f.kind === 'gap' ? 'leave a gap: some values fit no box' : 'overlap: one value fits two boxes'}, so the answer is ambiguous.`;
}

function groupIssues(
  group: OptionGroup,
): Array<GapOverlap | { kind: 'all-of-above'; first: string; second: string }> {
  const labels = group.options.map((o) => o.label);
  if (group.exclusive) {
    const all = labels.find((l) => ALL_ABOVE_RE.test(l.trim()));
    if (all && labels.length >= 3)
      return [{ kind: 'all-of-above', first: labels[0]!, second: all }];
  }
  if (labels.length < 2) return [];
  const ranges = labels.map(parseRange);
  if (ranges.some((r) => r === null)) return [];
  return rangeIssues(ranges as Range[]);
}

export const optionGapOverlap: Detector = {
  id: OPTION_GAP_OVERLAP_ID,
  class: 'option_gap_overlap',
  severity: 'high',
  explain,
  patternKey: (f) => patternKey(OPTION_GAP_OVERLAP_ID, String(f.kind ?? 'overlap')),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    for (const group of g.structure.optionGroups) {
      const issues = groupIssues(group);
      if (!issues.length) continue;
      const it = issues[0]!; // one finding per group (ids are sentence-anchored)
      const opt = group.options.find((o) => o.label === it.second) ?? group.options[0]!;
      const text = textOf(g, opt.blockIndex);
      const at = Math.max(0, text.indexOf(it.second));
      const facts = maskFacts({
        kind: it.kind,
        first: it.first.slice(0, 120),
        second: it.second.slice(0, 120),
        cue: group.cue ?? 'no cue printed',
        where: whereOf(g, opt.blockIndex),
        issues: issues.length,
      });
      out.push(
        buildFinding(g, {
          detectorId: OPTION_GAP_OVERLAP_ID,
          issueClass: 'option_gap_overlap',
          severity: 'high',
          confidence: 0.8,
          blockIndex: opt.blockIndex,
          matchStart: at,
          matchEnd: at + it.second.length,
          explanation: explain(facts),
          facts,
          expected:
            it.kind === 'gap'
              ? 'Ranges that meet with no missing values'
              : it.kind === 'overlap'
                ? 'Ranges that do not share a boundary value'
                : 'An exclusive group without an "all of the above" option',
          patternKey: optionGapOverlap.patternKey(facts),
        }),
      );
    }
    return out;
  },
};
