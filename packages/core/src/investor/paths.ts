import { checkTarget, conditionalTargets, sectionOfBlock } from '../detectors/flow';
import type { DocGraph } from '../graph/graph';
import type { Scope } from '../structure/types';
import { cleanLabel, extractInvestorTypes, investorGroups, withoutMarker } from './extract';
import {
  classifyType,
  FAMILY,
  typesIn,
  type InvestorModel,
  type InvestorPath,
  type InvestorTypeId,
  type PathCitation,
  type PathGap,
} from './types';

/**
 * Investor path computation (pure, deterministic). For each detected type, the applicable
 * sections of the main numbering scope in document order, after:
 *  - heading whitelists ("Custodian Information (IRA Subscribers only)")
 *  - type-specific instructions: complete (required items), skip (excluded sections),
 *    proceed/go to (sections jumped over are skipped)
 * A path is valid when the completion node (signature section / signature pages) stays on it.
 * Anything not proven (no completion node, unparsed target) marks the path `uncertain`.
 */
export const COMPLETION_TITLE_RE = /\bsignatures?\b|\bexecution\b|\bsign here\b/i;
export const ONLY_RE = /\bonly\b/i;

function mainScope(g: DocGraph): Scope | undefined {
  let best: Scope | undefined;
  for (const s of g.structure.scopes)
    if (s.sections.length > (best?.sections.length ?? 0)) best = s;
  return best;
}

function blockText(g: DocGraph, i: number): string {
  return g.structure.blocks[i]!.lines.map((l) => l.text).join(' ');
}

export function investorModel(g: DocGraph): InvestorModel {
  const types = extractInvestorTypes(g);
  const scope = mainScope(g);
  if (!types.length || !scope) return { types, paths: [], completion: null };
  const present = new Set(types.map((t) => t.id));
  const order = scope.sections.map((s) => s.number);

  // completion node
  let completion: { label: string; section: string | null } | null = null;
  const sigSec = [...scope.sections].reverse().find((s) => COMPLETION_TITLE_RE.test(s.title));
  if (sigSec)
    completion = {
      label: `Section ${sigSec.number} (${sigSec.title.slice(0, 60)})`,
      section: sigSec.number,
    };
  else if (
    scope.kind === 'signature' ||
    g.structure.scopes.some((s) => s.kind === 'signature' && s.ordinal > scope.ordinal)
  )
    completion = { label: 'the signature pages', section: null };

  // heading whitelists
  const whitelist = new Map<string, { types: Set<InvestorTypeId>; cite: PathCitation }>();
  for (const s of scope.sections) {
    if (!ONLY_RE.test(s.title)) continue;
    const named = typesIn(s.title).filter((t) => present.has(t));
    if (!named.length) continue;
    const text = blockText(g, s.blockIndex);
    whitelist.set(s.number, {
      types: new Set(named),
      cite: { text: text.slice(0, 200), blockIndex: s.blockIndex, start: 0, end: text.length },
    });
  }

  interface Acc {
    excluded: Map<string, PathCitation>;
    required: string[];
    gaps: PathGap[];
    citations: PathCitation[];
    uncertain: boolean;
    deadEnd?: { reason: string; citation: PathCitation };
  }
  const acc = new Map<InvestorTypeId, Acc>();
  for (const t of types)
    acc.set(t.id, { excluded: new Map(), required: [], gaps: [], citations: [], uncertain: false });

  for (const c of g.structure.conditionals) {
    const named = typesIn(c.role ?? c.trigger).filter((t) => present.has(t));
    if (!named.length) continue;
    const cite: PathCitation = {
      text: c.text.slice(0, 200),
      blockIndex: c.blockIndex,
      start: c.start,
      end: c.end,
    };
    const targets = conditionalTargets(g, c).map((t) => ({ t, chk: checkTarget(g, c, t) }));
    for (const id of named) {
      const a = acc.get(id)!;
      a.citations.push(cite);
      for (const { t, chk } of targets) {
        if (chk.status === 'uncertain') {
          a.uncertain = true;
          continue;
        }
        if (c.action === 'complete' || c.action === 'provide') {
          a.required.push(t.raw);
          if (chk.status === 'missing')
            a.gaps.push({ kind: 'part-c', item: chk.missing ?? t.raw, peers: [], citation: cite });
        } else if (c.action === 'skip' && t.section && !t.parts.length && chk.status === 'ok') {
          a.excluded.set(t.section, cite);
        } else if (c.action === 'proceed') {
          if (chk.status === 'missing') {
            a.deadEnd ??= {
              reason: `sends this type to ${chk.missing ?? t.raw}, which does not exist`,
              citation: cite,
            };
            continue;
          }
          const from = sectionOfBlock(g, c.blockIndex);
          if (!from || !t.section) continue;
          const fi = order.indexOf(from);
          const ti = order.indexOf(t.section);
          if (fi < 0 || ti < 0) continue;
          for (let k = fi + 1; k < ti; k++) a.excluded.set(order[k]!, cite);
        }
      }
    }
  }

  // PATH-04 peer items: within a family, >= 2 peers carry footnote m and this type does not
  for (const group of investorGroups(g)) {
    const typed = group.options
      .map((o) => ({ o, id: classifyType(cleanLabel(withoutMarker(o.label, o.footnote_marker))) }))
      .filter((x): x is { o: (typeof group.options)[number]; id: InvestorTypeId } => x.id !== null);
    const markers = [
      ...new Set(typed.map((x) => x.o.footnote_marker).filter((m): m is string => !!m)),
    ];
    for (const m of markers) {
      const carriers = typed.filter((x) => x.o.footnote_marker === m);
      for (const fam of new Set(carriers.map((x) => FAMILY[x.id]))) {
        const peers = carriers.filter((x) => FAMILY[x.id] === fam).map((x) => x.id);
        if (peers.length < 2) continue;
        for (const x of typed) {
          if (FAMILY[x.id] !== fam || x.o.footnote_marker) continue;
          const text = blockText(g, x.o.blockIndex);
          const at = Math.max(0, text.indexOf(x.o.label));
          acc.get(x.id)?.gaps.push({
            kind: 'peer-item',
            item: `footnote ${m}`,
            peers,
            citation: {
              text: x.o.label.slice(0, 200),
              blockIndex: x.o.blockIndex,
              start: at,
              end: at + x.o.label.length,
            },
          });
        }
      }
    }
  }

  const paths: InvestorPath[] = types.map((t) => {
    const a = acc.get(t.id)!;
    const sections: string[] = [];
    const skipped: string[] = [];
    const skipCause = new Map<string, PathCitation>();
    for (const n of order) {
      const wl = whitelist.get(n);
      if (a.excluded.has(n)) {
        skipped.push(n);
        skipCause.set(n, a.excluded.get(n)!);
      } else if (wl && !wl.types.has(t.id)) {
        skipped.push(n);
        skipCause.set(n, wl.cite);
      } else sections.push(n);
    }
    // required items on skipped sections: "must also complete Part C" while the section is skipped
    for (const r of a.required) {
      const sec = /Section (\d{1,2}[A-Z]?)$/.exec(r)?.[1];
      if (sec && skipped.includes(sec) && !a.gaps.some((x) => x.item === r))
        a.gaps.push({
          kind: 'part-c',
          item: `${r} (skipped for this type)`,
          peers: [],
          citation: skipCause.get(sec)!,
        });
    }
    const uncertain = a.uncertain || completion === null;
    let reaches = !uncertain && !a.deadEnd;
    let deadEnd = a.deadEnd;
    if (reaches && completion?.section && !sections.includes(completion.section)) {
      reaches = false;
      deadEnd = {
        reason: `skips ${completion.label}, so this type never reaches the signature`,
        citation: skipCause.get(completion.section)!,
      };
    }
    const questions: Array<{ section: string; text: string }> = [];
    for (const n of sections) {
      const sec = scope.sections.find((s) => s.number === n)!;
      const next =
        scope.sections[scope.sections.indexOf(sec) + 1]?.blockIndex ?? g.structure.blocks.length;
      let k = 0;
      // listed questions: field labels that read as a question (short fragments such as "Other"
      // or "State of" are fill-in parts of an option, not questions)
      for (const f of g.structure.fields)
        if (
          f.blockIndex > sec.blockIndex &&
          f.blockIndex < next &&
          k < 4 &&
          f.label.trim().length >= 10
        ) {
          questions.push({ section: n, text: f.label.slice(0, 80) });
          k++;
        }
    }
    const path: InvestorPath = {
      type: t.id,
      label: t.label,
      sections,
      skipped,
      questions,
      required: a.required,
      reachesCompletion: reaches,
      uncertain,
      citations: a.citations,
      gaps: a.gaps,
    };
    if (!reaches && !uncertain && deadEnd) path.deadEnd = deadEnd;
    return path;
  });
  return { types, paths, completion: completion?.label ?? null };
}

const MEMO = new WeakMap<DocGraph, InvestorModel>();

/** Memoized per DocGraph (detectors and buildStructureView share one computation). */
export function investorModelOf(g: DocGraph): InvestorModel {
  let m = MEMO.get(g);
  if (!m) {
    m = investorModel(g);
    MEMO.set(g, m);
  }
  return m;
}
