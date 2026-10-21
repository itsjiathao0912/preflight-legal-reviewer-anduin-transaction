import type { Owner } from '@aduin/core';
import type { SevKey } from '../review/severity';
import { itemNeedsAnswer, type QuestionItem } from '../variance/owner-groups';

/**
 * Questions table (20-10-26 layout): UI-only display helpers and the Status / Who / Severity filter.
 * Nothing here changes the question wording (core's template draft also feeds the DOCX export).
 */
export type StatusFilter = 'all' | 'open' | 'answered';
export type WhoFilter = 'all' | Owner;
export type SevFilter = 'all' | SevKey;

export interface QuestionFilters {
  status: StatusFilter;
  who: WhoFilter;
  sev: SevFilter;
}

export const NO_FILTERS: QuestionFilters = Object.freeze({ status: 'all', who: 'all', sev: 'all' });

/** Number of active (non-All) filter rows, for the "Filter · k" button. */
export function activeFilterCount(f: QuestionFilters): number {
  return (f.status !== 'all' ? 1 : 0) + (f.who !== 'all' ? 1 : 0) + (f.sev !== 'all' ? 1 : 0);
}

/** One table row's filter facts (questions and the GP request row share it). */
export interface RowFacts {
  owner: Owner;
  sev: SevKey;
  waiting: boolean;
}

export const questionFacts = (q: QuestionItem): RowFacts => ({
  owner: q.owner,
  sev: q.row.sev,
  waiting: itemNeedsAnswer(q),
});

/** Filters combine with AND. */
export function matchesFilters(x: RowFacts, f: QuestionFilters): boolean {
  if (f.status === 'open' && !x.waiting) return false;
  if (f.status === 'answered' && x.waiting) return false;
  if (f.who !== 'all' && x.owner !== f.who) return false;
  if (f.sev !== 'all' && x.sev !== f.sev) return false;
  return true;
}

export function clampText(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:·-]+$/, '')}…`;
}

/** Short baseline name for the "Changed since …" title. */
export function baselineShort(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  return t ? clampText(t, 28) : 'last version';
}

/**
 * Short row title (UI only): change questions "Changed since <baseline> · <location>", broken
 * cross-references "Broken cross-reference · <location>", otherwise the finding title shortened.
 */
export function shortTitle(q: QuestionItem, baseline: string | null | undefined): string {
  const f = q.row.f;
  const loc = clampText(f.loc, 40);
  if (q.change) return `Changed since ${baselineShort(baseline)} · ${loc}`;
  if (f.issue_class === 'broken_cross_reference') return `Broken cross-reference · ${loc}`;
  return clampText(f.title, 80);
}

/**
 * Quote snippet that starts at a word boundary: a quote cut mid-word ("p Agreement…", "ver to the
 * Administrator…") loses its leading partial word and gets a leading "…". A quote that starts with
 * a capital, a digit, a quote mark or an opening bracket is left as is.
 */
export function snipQuote(q: string): string {
  const t = q.replace(/\s+/g, ' ').trim();
  if (!t || t.startsWith('…')) return t;
  if (!/^[a-z]/.test(t)) return t;
  const sp = t.indexOf(' ');
  if (sp < 0 || sp >= t.length - 1) return t;
  return `…${t.slice(sp + 1)}`;
}
