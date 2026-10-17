import type { DeltaRow, DiffMode, DiffResult, Excerpt, Segment, SectionDiff } from '@aduin/core';

/**
 * Compare view model (types only from core). Turns a DiffResult into list items, filter chips and
 * groups following app.html #v-compare. Pure; the view masks every excerpt at render time.
 */
export type ItemKind =
  | 'added'
  | 'removed'
  | 'renamed'
  | 'moved'
  | 'changed'
  | 'fixed'
  | 'still'
  | 'new'
  | 'low'
  | 'common'
  | 'differing'
  | 'only_a'
  | 'only_b';

export type GroupId =
  'sections' | 'renames' | 'definitions' | 'fees' | 'requirements' | 'findings' | 'clauses' | 'low';

export interface CmpItem {
  id: string;
  group: GroupId;
  kind: ItemKind;
  /** Plain title from headings / terms (never excerpt text). */
  title: string;
  /** Excerpt shown as the title (masked at render) when there is no heading. */
  titleEx?: Excerpt;
  sub: string;
  a?: Excerpt;
  b?: Excerpt;
  segments?: Segment[];
  truncated?: boolean;
  /** Findings-delta rows: the finding this row stands for (fixed: side A, else side B). */
  findingId?: string;
  /** Diff-only rows and delta rows alike; low-confidence rows are not counted. */
  counted: boolean;
  note?: string;
}

export const GROUPS: Record<DiffMode, { id: GroupId; title: string }[]> = {
  version: [
    { id: 'sections', title: 'Sections' },
    { id: 'renames', title: 'Terms renamed' },
    { id: 'definitions', title: 'Definitions' },
    { id: 'fees', title: 'Fees' },
    { id: 'requirements', title: 'Requirements' },
    { id: 'findings', title: 'Earlier findings' },
    { id: 'low', title: 'Low confidence, not counted' },
  ],
  sibling: [
    { id: 'clauses', title: 'Clauses' },
    { id: 'findings', title: 'Findings delta' },
  ],
};

export interface ChipDef {
  k: string;
  label: string;
  match: (i: CmpItem) => boolean;
}

export function chipGroups(mode: DiffMode): { cap: string; chips: ChipDef[] }[] {
  const k =
    (...kinds: ItemKind[]) =>
    (i: CmpItem) =>
      i.counted && kinds.includes(i.kind);
  if (mode === 'version')
    return [
      {
        cap: 'Changes',
        chips: [
          { k: 'added', label: 'added', match: k('added') },
          { k: 'removed', label: 'removed', match: k('removed') },
          { k: 'renamed', label: 'renamed', match: k('renamed') },
          { k: 'changed', label: 'changed', match: k('changed', 'moved') },
        ],
      },
      {
        cap: 'Earlier findings',
        chips: [
          { k: 'fixed', label: 'fixed', match: k('fixed') },
          { k: 'still', label: 'still present', match: k('still') },
          { k: 'new', label: 'new', match: k('new') },
        ],
      },
    ];
  return [
    {
      cap: 'Clauses',
      chips: [
        { k: 'common', label: 'common', match: k('common') },
        { k: 'differing', label: 'differing', match: k('differing') },
        { k: 'only', label: 'only in one', match: k('only_a', 'only_b') },
      ],
    },
    {
      cap: 'Findings delta',
      chips: [
        { k: 'still', label: 'in both', match: k('still') },
        { k: 'fixed', label: 'only in A', match: k('fixed') },
        { k: 'new', label: 'only in B', match: k('new') },
      ],
    },
  ];
}

export const KIND_LABEL: Record<ItemKind, string> = {
  added: 'Added',
  removed: 'Removed',
  renamed: 'Renamed',
  moved: 'Moved',
  changed: 'Changed',
  fixed: 'Fixed',
  still: 'Still present',
  new: 'New',
  low: 'Possible leftover',
  common: 'Common',
  differing: 'Differing',
  only_a: 'Only in A',
  only_b: 'Only in B',
};

const pathText = (p?: string[]) => (p && p.length ? p.join(' › ') : 'Before the first section');

function sectionTitle(s: SectionDiff): string {
  if (s.status === 'renamed' && s.titleA && s.titleB) return `${s.titleA} to ${s.titleB}`;
  return s.titleB ?? s.titleA ?? pathText(s.pathB ?? s.pathA);
}

const prettyClass = (c: string) => {
  const t = c.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function deltaItem(r: DeltaRow, kind: 'fixed' | 'still' | 'new', n: number): CmpItem {
  const findingId = kind === 'fixed' ? r.findingIdA : r.findingIdB;
  return {
    id: `f-${kind}-${n}`,
    group: 'findings',
    kind,
    title: `${prettyClass(r.issue_class)} (${r.detector_id})`,
    sub: pathText(kind === 'fixed' ? r.pathA : (r.pathB ?? r.pathA)),
    ...(kind === 'fixed' ? { a: r.excerpt } : { b: r.excerpt }),
    ...(findingId ? { findingId } : {}),
    counted: true,
  };
}

/** Every list item for a result, in group order. */
export function itemsOf(r: DiffResult): CmpItem[] {
  const out: CmpItem[] = [];
  if (r.mode === 'sibling') {
    (r.clauses ?? []).forEach((c, n) => {
      const kind: ItemKind = c.label;
      out.push({
        id: `c-${n}`,
        group: 'clauses',
        kind,
        title: '',
        ...(c.b || c.a ? { titleEx: (c.b ?? c.a)! } : {}),
        sub: pathText(c.pathB ?? c.pathA),
        ...(c.a ? { a: c.a } : {}),
        ...(c.b ? { b: c.b } : {}),
        ...(c.segments ? { segments: c.segments } : {}),
        truncated: c.truncated,
        counted: true,
      });
    });
  } else {
    r.sections.forEach((s, n) => {
      if (s.status === 'same') return;
      out.push({
        id: `s-${n}`,
        group: 'sections',
        kind: s.status,
        title: sectionTitle(s),
        sub: `${s.kind === 'part' ? 'Part' : s.kind === 'scope' ? 'Preamble' : 'Section'} · ${pathText(s.pathB ?? s.pathA)}`,
        ...(s.a ? { a: s.a } : {}),
        ...(s.b ? { b: s.b } : {}),
        ...(s.segments ? { segments: s.segments } : {}),
        truncated: s.truncated,
        counted: true,
      });
    });
    r.renames.forEach((x, n) =>
      out.push({
        id: `r-${n}`,
        group: 'renames',
        kind: 'renamed',
        title: `${x.from} to ${x.to}`,
        sub: `${x.count} of ${x.occurrences} uses · confidence ${x.confidence.toFixed(2)}`,
        counted: true,
        note: 'Inferred from same-position substitutions in aligned sentences.',
      }),
    );
    r.definitions.forEach((d, n) =>
      out.push({
        id: `d-${n}`,
        group: 'definitions',
        kind: d.status,
        title:
          d.status === 'renamed' && d.termB
            ? `Defined term “${d.term}” to “${d.termB}”`
            : `Defined term “${d.term}”`,
        sub: pathText(d.pathB ?? d.pathA),
        ...(d.a ? { a: d.a } : {}),
        ...(d.b ? { b: d.b } : {}),
        counted: true,
      }),
    );
    r.fees.forEach((f, n) => {
      if (f.status === 'same') return;
      const m = f.b ?? f.a!;
      out.push({
        id: `fee-${n}`,
        group: 'fees',
        kind: f.status,
        title: `Fee ${m.percent}${m.feeClass ? ` · Class ${m.feeClass}` : ''}`,
        sub: pathText(m.path),
        ...(f.a ? { a: f.a.excerpt } : {}),
        ...(f.b ? { b: f.b.excerpt } : {}),
        counted: true,
      });
    });
    r.requirements.forEach((q, n) =>
      out.push({
        id: `q-${n}`,
        group: 'requirements',
        kind: q.status,
        title: '',
        titleEx: q.excerpt,
        sub: pathText(q.path),
        ...(q.status === 'removed' ? { a: q.excerpt } : { b: q.excerpt }),
        counted: true,
      }),
    );
  }
  r.findingsDelta.fixed.forEach((d, n) => out.push(deltaItem(d, 'fixed', n)));
  r.findingsDelta.stillPresent.forEach((d, n) => out.push(deltaItem(d, 'still', n)));
  r.findingsDelta.new.forEach((d, n) => out.push(deltaItem(d, 'new', n)));
  if (r.mode === 'version')
    r.possibleLeftovers.forEach((p, n) =>
      out.push({
        id: `low-${n}`,
        group: 'low',
        kind: 'low',
        title: `“${p.term}” kept ${p.countB} time${p.countB === 1 ? '' : 's'}`,
        sub: `Possible leftover · confidence ${p.confidence.toFixed(2)} · severity ${p.severity}`,
        ...(p.b ? { b: p.b } : {}),
        counted: false,
        note: `Low confidence, not asserted. It appeared next to ${p.cooccursWith.join(', ') || 'renamed terms'}; counsel decides whether it should change. Not a finding and not counted.`,
      }),
    );
  return out;
}

/** Items in display order (group order) after an optional chip filter. */
export function visibleItems(items: CmpItem[], mode: DiffMode, filter: string | null): CmpItem[] {
  const chip = filter
    ? chipGroups(mode)
        .flatMap((g) => g.chips)
        .find((c) => c.k === filter)
    : undefined;
  const list = chip ? items.filter(chip.match) : items;
  return GROUPS[mode].flatMap((g) => list.filter((i) => i.group === g.id));
}
