import { sha256Hex } from '../model/hash';
import type { Block } from '../model/types';
import type { Conditional } from './types';

/**
 * Conditionals (whitelist). Linear-time: text is cut into clauses (on . or ;,
 * max CLAUSE_MAX chars); in each clause we look for a trigger word, then the
 * first action verb within VERB_WINDOW chars, then the first Section/Part
 * target within TARGET_WINDOW chars. No nested or unbounded quantifiers.
 * Role-routing table rows ("Custodial account Please complete Part A of Section 2") are role conditionals.
 * Negative gate: "do not complete", "need not complete", "skip".
 */
export const CLAUSE_MAX = 400;
export const VERB_WINDOW = 160;
export const TARGET_WINDOW = 80;
export const TRIGGER_RE = /\b(?:if|unless|only if|in the case of|for)\b/i;
export const VERB_RE =
  /\b(do not complete|need not complete|complete|skip|proceed to|go to|provide|see)\b/i;
export const TARGET_RE = /\b(Sections?|Parts?)\s+(\d{1,2}[A-Z]?|[A-Z])\b/;
export const MORE_TARGETS_RE =
  /^\s*(?:,|and|or|&|and\/or)\s*(?:Sections?\s+)?(\d{1,2}[A-Z]?|[A-Z])\b/;
export const ROLE_ROW_RE = /^([A-Z][A-Za-z/ ,'-]{2,60}?)\s+Please\s+(complete|skip)\s/;
export const ROW_TARGET_RE =
  /\b(Parts?\s+[A-Z](?:\s*(?:&|and|or)\s*[A-Z]){0,3}\s+of\s+Section\s+\d{1,2}|Section\s+\d{1,2}[A-Z]?)/g;

function actionOf(verb: string): Conditional['action'] {
  const v = verb.toLowerCase();
  if (v.includes('complete')) return 'complete';
  if (v === 'skip') return 'skip';
  if (v === 'proceed to' || v === 'go to') return 'proceed';
  if (v === 'provide') return 'provide';
  return 'see';
}

export function clauses(text: string): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = [];
  let s = 0;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (i === text.length || ch === '.' || ch === ';' || i - s >= CLAUSE_MAX) {
      if (i > s) out.push({ start: s, text: text.slice(s, i) });
      s = i + (ch === '.' || ch === ';' ? 1 : 0);
    }
  }
  return out;
}

function conditionalsInClause(
  block: Block,
  bi: number,
  c: { start: number; text: string },
): Conditional | null {
  const trig = TRIGGER_RE.exec(c.text);
  if (!trig) return null;
  const afterTrig = trig.index + trig[0].length;
  const verbWin = c.text.slice(afterTrig, afterTrig + VERB_WINDOW);
  const verb = VERB_RE.exec(verbWin);
  if (!verb) return null;
  const afterVerb = afterTrig + verb.index + verb[0].length;
  const tWin = c.text.slice(afterVerb, afterVerb + TARGET_WINDOW);
  const target = TARGET_RE.exec(tWin);
  if (!target) return null;
  const head = /^Part/i.test(target[1]!) ? 'Part' : 'Section';
  const targets = [`${head} ${target[2]}`];
  let rest = tWin.slice(target.index + target[0].length);
  for (let k = 0; k < 8; k++) {
    const more = MORE_TARGETS_RE.exec(rest);
    if (!more) break;
    targets.push(`${head} ${more[1]}`);
    rest = rest.slice(more[0].length);
  }
  const start = c.start + trig.index;
  const end = c.start + afterVerb + target.index + target[0].length;
  const v = verb[1]!.toLowerCase();
  return {
    id: 'cond_' + sha256Hex(`${block.id}|${start}|${end}`).slice(0, 16),
    blockIndex: bi,
    start,
    end,
    text: c.text.slice(trig.index, end - c.start),
    trigger: c.text.slice(trig.index, afterTrig + verb.index).trim(),
    action: actionOf(v),
    negative: v.startsWith('do not') || v.startsWith('need not') || v === 'skip',
    targets,
  };
}

export function extractConditionals(blocks: Block[]): Conditional[] {
  const out: Conditional[] = [];
  blocks.forEach((b, bi) => {
    const text = b.lines.map((l) => l.text).join(' ');
    const row = ROLE_ROW_RE.exec(text.slice(0, 200));
    if (row) {
      const targets: string[] = [];
      for (const t of text.slice(0, CLAUSE_MAX).matchAll(ROW_TARGET_RE)) targets.push(t[1]!);
      if (targets.length) {
        out.push({
          id: 'cond_' + sha256Hex(`${b.id}|row`).slice(0, 16),
          blockIndex: bi,
          start: 0,
          end: Math.min(text.length, CLAUSE_MAX),
          text: text.slice(0, CLAUSE_MAX),
          trigger: row[1]!.trim(),
          action: row[2]!.toLowerCase() === 'skip' ? 'skip' : 'complete',
          negative: row[2]!.toLowerCase() === 'skip',
          targets,
          role: row[1]!.trim(),
        });
        return;
      }
    }
    for (const c of clauses(text)) {
      const cond = conditionalsInClause(b, bi, c);
      if (cond) out.push(cond);
    }
  });
  return out;
}
