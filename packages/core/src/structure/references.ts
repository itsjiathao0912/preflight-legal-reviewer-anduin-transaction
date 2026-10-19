import { makeAnchor } from '../model/anchors';
import { sha256Hex } from '../model/hash';
import type { Block, Reference } from '../model/types';
import {
  BARE_REPEAT_WINDOW,
  CFR_RE,
  RULE_RE,
  USC_RE,
  localStatutoryRule,
  type StatutoryRule,
} from './statutory';
import { titleTokens } from './numbering-scopes';
import type { BlockInfo, RefInfo, Scope, Section } from './types';

/**
 * Reference extraction and resolution (L.1 scope resolution, S exclusions,
 * "this Section N"). Every pattern is linear-time.
 */

/** "this Section N" (R). Decimal sections ("3.10") are excluded. */
export const THIS_SECTION_RE =
  /\bthis\s+Section\s+(\d{1,3}[A-Z]?)((?:\([a-z0-9]{1,6}\)){0,6})(?![.]\d|\d|\s+of\s)/g;
/** L-form "<verb> in Part X of Section N [of the <Scope Name>]". */
export const PART_OF_SECTION_RE = /\bPart\s+([A-Z])\s+of\s+Section\s+(\d{1,3}[A-Z]?)\b/g;
export const L_VERB_RE = /\b(indicated|specified|set forth|described)\s+in\s*$/;
export const QUALIFIER_RE =
  /^\s{0,4},?\s{0,4}of\s+(?:the\s+)?((?:[A-Z][A-Za-z&]{0,30}\s+){0,6}(?:Signature Pages|Agreement|Application))\b/;
/** Any "Section(s) N" mention. */
export const SECTION_RE = /\bSections?\s+(\d{1,4}[A-Z]?)((?:\([A-Za-z0-9]{1,6}\)){0,6})/g;

interface Ctx {
  blocks: Block[];
  info: BlockInfo[];
  scopes: Scope[];
}

function refId(blockId: string, start: number, end: number, form: string): string {
  return 'ref_' + sha256Hex(`${blockId}|${start}|${end}|${form}`).slice(0, 16);
}

function blockText(b: Block): string {
  return b.lines.map((l) => l.text).join(' ');
}

/** Scope whose sections have Parts (L.1); the first such scope wins. */
function scopeWithParts(scopes: Scope[]): Scope | undefined {
  return scopes.find((s) => s.sections.some((sec) => sec.parts.length > 0));
}

function scopeByQualifier(scopes: Scope[], qualifier: string): Scope | undefined {
  const q = titleTokens(qualifier);
  let best: Scope | undefined;
  let bestScore = 0;
  for (const s of scopes) {
    const t = titleTokens(s.title);
    let hit = 0;
    for (const tok of q) if (t.has(tok)) hit++;
    const score = q.size ? hit / q.size : 0;
    if (score > bestScore && s.sections.length > 0) {
      best = s;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

export function findSection(scope: Scope | undefined, number: string): Section | undefined {
  return scope?.sections.find((s) => s.number === number);
}

/** Resolve the scope for a section reference per L.1. */
export function resolveScope(
  ctx: Ctx,
  own: Scope,
  number: string,
  part: string | undefined,
  qualifier: string | undefined,
): Scope | undefined {
  if (qualifier) {
    const q = scopeByQualifier(ctx.scopes, qualifier);
    if (q) return q;
  }
  if (part) {
    const withParts = scopeWithParts(ctx.scopes);
    if (withParts && findSection(withParts, number)) return withParts;
    // nearest scope (own first) that has section N with Part X
    const ordered = [own, ...ctx.scopes.filter((s) => s !== own)];
    const exact = ordered.find((s) => findSection(s, number)?.parts.some((p) => p.letter === part));
    if (exact) return exact;
  }
  if (findSection(own, number)) return own;
  const withSection = ctx.scopes.filter((s) => findSection(s, number));
  if (withSection.length === 1) return withSection[0];
  if (withSection.length > 1) {
    // closest title-token overlap with the own scope title
    const own_t = titleTokens(own.title);
    let best = withSection[0]!;
    let bestHit = -1;
    for (const s of withSection) {
      let hit = 0;
      for (const tok of titleTokens(s.title)) if (own_t.has(tok)) hit++;
      if (hit > bestHit) {
        best = s;
        bestHit = hit;
      }
    }
    return best;
  }
  return undefined;
}

function maxSection(scope: Scope | undefined): number {
  let max = 0;
  for (const s of scope?.sections ?? []) max = Math.max(max, s.num);
  return max;
}

export function extractReferences(ctx: Ctx): RefInfo[] {
  const out: RefInfo[] = [];
  const docMax = Math.max(0, ...ctx.scopes.map((s) => maxSection(s)));
  // concatenated doc text offsets for the bare-repeat rule
  const offsets: number[] = [];
  let acc = 0;
  for (const b of ctx.blocks) {
    offsets.push(acc);
    acc += blockText(b).length + 1;
  }
  const statutoryAt: Array<{ number: string; pos: number }> = [];
  // Subsection labels present in the text ("3.2 Notice and Funding" inside Section 3), keyed
  // scopeId|N.M. A decimal ref "Section 3.2" resolves to its parent section only when that
  // labelled subsection exists in the parent (DOCX numbered sub-clauses); otherwise it stays
  // unresolved as before.
  const subsections = new Set<string>();
  ctx.blocks.forEach((b, i) => {
    const sec = ctx.info[i]?.section;
    const m = /^\s{0,4}(\d{1,4}[A-Z]?)\.(\d{1,3})(?!\d|\.\d)/.exec(blockText(b));
    if (sec && m && m[1] === sec.number) subsections.add(`${sec.scopeId}|${m[1]}.${m[2]}`);
  });

  const push = (r: RefInfo) => out.push(r);

  ctx.blocks.forEach((block, bi) => {
    const text = blockText(block);
    const info = ctx.info[bi]!;
    const covered: Array<[number, number]> = [];
    const isCovered = (s: number) => covered.some(([a, b]) => s >= a && s < b);

    // 1) "this Section N"
    for (const m of text.matchAll(THIS_SECTION_RE)) {
      const start = m.index!;
      const end = start + m[0].length;
      // "of this Section" is still "this Section"; the R pattern excludes "of" only as a prefix word to "Section"
      covered.push([start, end]);
      const number = m[1]!;
      const enc = info.section;
      const ref: Reference = {
        id: refId(block.id, start, end, 'this_section'),
        text: m[0],
        kind: 'internal',
        status: enc ? 'resolved' : 'unresolved',
        anchor: makeAnchor(block.anchor.docHash, block.id, start, end),
      };
      if (enc) ref.target = { sectionNumber: number, scopeId: enc.scopeId };
      push({ ref, form: 'this_section', blockIndex: bi, start, end, sectionNumber: number });
    }

    // 2) "Part X of Section N [of the <Scope>]"
    for (const m of text.matchAll(PART_OF_SECTION_RE)) {
      const start = m.index!;
      const end = start + m[0].length;
      covered.push([start + m[0].indexOf('Section'), end]);
      const part = m[1]!;
      const number = m[2]!;
      const before = text.slice(Math.max(0, start - 40), start);
      const verbM = L_VERB_RE.exec(before);
      const qualM = QUALIFIER_RE.exec(text.slice(end, end + 120));
      const qualifier = qualM ? qualM[1]!.trim() : undefined;
      const scope = resolveScope(ctx, info.scope, number, part, qualifier);
      const sec = findSection(scope, number);
      const ref: Reference = {
        id: refId(block.id, start, end, 'part_of_section'),
        text: m[0],
        kind: 'internal',
        status: sec ? 'resolved' : 'unresolved',
        anchor: makeAnchor(block.anchor.docHash, block.id, start, end),
      };
      if (scope) ref.target = { sectionNumber: number, part, scopeId: scope.id };
      const r: RefInfo = {
        ref,
        form: 'part_of_section',
        blockIndex: bi,
        start,
        end,
        sectionNumber: number,
        part,
      };
      if (verbM) r.verb = verbM[1]!;
      if (qualifier) r.qualifier = qualifier;
      push(r);
    }

    // 3) Rule / U.S.C. / C.F.R. (statutory, never flagged)
    for (const re of [RULE_RE, USC_RE, CFR_RE]) {
      for (const m of text.matchAll(re)) {
        const start = m.index!;
        const end = start + m[0].length;
        push({
          ref: {
            id: refId(block.id, start, end, 'statutory'),
            text: m[0],
            kind: 'statutory',
            status: 'resolved',
            anchor: makeAnchor(block.anchor.docHash, block.id, start, end),
          },
          form: re === RULE_RE ? 'rule' : 'usc_cfr',
          blockIndex: bi,
          start,
          end,
          rule: re === RULE_RE ? 'rule-under' : 'usc-cfr',
        });
      }
    }

    // 4) every other "Section N"
    for (const m of text.matchAll(SECTION_RE)) {
      const start = m.index!;
      const sectionStart = start;
      if (isCovered(sectionStart) || isCovered(start + m[0].indexOf(m[1]!))) continue;
      const number = m[1]!;
      const chain = m[2] ?? '';
      const end = start + m[0].length;
      const after = text.slice(end);
      let rule: StatutoryRule | null = null;
      if (/^\.\d/.test(after)) rule = 'decimal-section';
      rule = rule ?? localStatutoryRule(after, chain);
      const docPos = offsets[bi]! + start;
      if (rule === 'marker-after' || rule === 'of-the-act' || rule === 'subsection-chain') {
        statutoryAt.push({ number, pos: docPos });
      } else if (!rule) {
        if (
          statutoryAt.some(
            (s) => s.number === number && docPos - s.pos <= BARE_REPEAT_WINDOW && docPos >= s.pos,
          )
        ) {
          rule = 'bare-repeat';
        }
      }
      const qualM =
        /^\s*(?:of|in)\s+(?:the\s+)?((?:[A-Z][A-Za-z&]{0,30}\s+){0,6}(?:Signature Pages|Agreement|Application))\b/.exec(
          after.slice(0, 120),
        );
      const qualifier = qualM ? qualM[1]!.trim() : undefined;
      let kind: Reference['kind'] = 'internal';
      let status: Reference['status'] = 'resolved';
      let target: Reference['target'];
      if (rule === 'decimal-section') {
        kind = 'internal';
        status = 'unresolved';
        const sub = /^\.(\d{1,3})(?!\d|\.\d)/.exec(after);
        const scope = sub ? resolveScope(ctx, info.scope, number, undefined, qualifier) : undefined;
        if (
          sub &&
          scope &&
          findSection(scope, number) &&
          subsections.has(`${scope.id}|${number}.${sub[1]}`)
        ) {
          status = 'resolved';
          target = { sectionNumber: number, scopeId: scope.id };
        }
      } else if (rule) {
        kind = 'statutory';
      } else {
        const scope = resolveScope(ctx, info.scope, number, undefined, qualifier);
        const sec = findSection(scope, number);
        const activeMax = maxSection(info.scope) || docMax;
        if (sec && scope) {
          target = { sectionNumber: number, scopeId: scope.id };
        } else if (Number.parseInt(number, 10) > activeMax) {
          kind = 'external';
          rule = 'out-of-range';
        } else {
          status = 'unresolved';
        }
      }
      const ref: Reference = {
        id: refId(block.id, start, end, 'section'),
        text: m[0],
        kind,
        status,
        anchor: makeAnchor(block.anchor.docHash, block.id, start, end),
      };
      if (target) ref.target = target;
      const r: RefInfo = {
        ref,
        form: 'section',
        blockIndex: bi,
        start,
        end,
        sectionNumber: number,
      };
      if (rule) r.rule = rule;
      if (qualifier) r.qualifier = qualifier;
      push(r);
    }
  });
  out.sort(
    (a, b) =>
      a.blockIndex - b.blockIndex ||
      a.start - b.start ||
      (a.form < b.form ? -1 : a.form > b.form ? 1 : 0),
  );
  return out;
}
