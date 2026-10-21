import { maskAndClamp, type ExternalReference } from '@aduin/core';
import type { StructureView } from '@aduin/core';
import type { BlockView, FindingView } from '../../../engine/types';
import { TYPE_LABELS } from '../../open-document/PackageConfirmTable';
import type { PackageDocView, PackageView } from '../../package/contract';
import { typeLabel } from '../../package/open-file';
import {
  candidatesFor,
  FAMILY_LABEL,
  groupResolution,
  STATUS as REF_STATUS,
} from '../../package/PackageReferences';
import { findingAt, findingForTerm } from '../../structure/SeeInFindings';
import { TERM_STATUS } from '../../structure/model';

type IconName = 'check' | 'stop' | 'warn' | 'info';

/** The one action a Sources row offers. */
export type SourceAction =
  | { kind: 'finding'; findingId: string }
  | { kind: 'open'; docId: string; blockIndex: number | null; label: string }
  | { kind: 'gp' }
  | { kind: 'confirm'; targetKey: string; candidates: PackageDocView[] }
  | null;

export interface SourceRow {
  key: string;
  /** Lowercased name used by "See in Sources" to find the row. */
  targetKey: string;
  item: string;
  kind: string;
  status: { cls: string; icon: IconName; label: string };
  missing: boolean;
  /** Block to show in the document (item click). */
  blockId: string | null;
  quote: string | null;
  action: SourceAction;
}

const RANK = { block: 0, fix: 1, other: 2 };
const rank = (r: SourceRow) =>
  r.status.cls === 'b-block' ? RANK.block : r.status.cls === 'b-fix' ? RANK.fix : RANK.other;

/**
 * Defined terms (with an issue), references to other documents and package terms as one table,
 * problems first. Pure: reads the engine StructureView and the PackageView only.
 */
export function sourceRows(
  v: StructureView | undefined,
  pkg: PackageView | null,
  findings: FindingView[] | undefined,
  blocks: BlockView[] | undefined,
): SourceRow[] {
  const out: SourceRow[] = [];
  for (const t of v?.terms ?? []) {
    if (!t.issue) continue;
    const st = TERM_STATUS[t.status];
    const f = t.findingId ?? findingForTerm(findings, t.term)?.id ?? null;
    out.push({
      key: `t:${t.id}`,
      targetKey: t.term.toLowerCase(),
      item: t.term,
      kind: 'Term',
      status: { cls: st.cls, icon: st.icon as IconName, label: st.label },
      missing: t.status === 'none',
      blockId: t.blockId,
      quote: null,
      action: f ? { kind: 'finding', findingId: f } : null,
    });
  }
  if (pkg) {
    const groups = new Map<string, ExternalReference[]>();
    for (const r of pkg.references) {
      const g = groups.get(r.targetKey);
      if (g) g.push(r);
      else groups.set(r.targetKey, [r]);
    }
    for (const refs of groups.values()) {
      const first = refs[0]!;
      const res = groupResolution(refs);
      const st = REF_STATUS[res];
      const linked = refs
        .map((r) => findingAt(findings, r.location.blockIndex, first.targetLabel))
        .find(Boolean);
      const resolved = refs.find((r) => r.resolution === 'resolved');
      const target = resolved
        ? pkg.documents.find((d) => d.id === resolved.resolvedDocId)
        : undefined;
      const unclear = refs.find((r) => r.resolution === 'unclear');
      let action: SourceAction = null;
      if (linked) action = { kind: 'finding', findingId: linked.id };
      else if (unclear)
        action = {
          kind: 'confirm',
          targetKey: first.targetKey,
          candidates: candidatesFor(unclear, pkg.documents),
        };
      else if (res === 'not_in_package') action = { kind: 'gp' };
      else if (resolved && target && !target.isPrimary)
        action = {
          kind: 'open',
          docId: target.id,
          blockIndex: resolved.resolvedPart ? resolved.resolvedPart.blockIndex : null,
          label: typeLabel(target.type),
        };
      out.push({
        key: `r:${first.targetKey}`,
        targetKey: first.targetKey.toLowerCase(),
        item: maskAndClamp(first.targetLabel, 80),
        kind: FAMILY_LABEL[first.targetFamily],
        status: { cls: st.cls, icon: st.icon, label: st.label },
        missing: res === 'not_in_package',
        blockId: blocks?.[first.location.blockIndex]?.id ?? null,
        quote: first.quote,
        action,
      });
    }
    for (const t of pkg.terms) {
      const def = pkg.documents.find((d) => d.id === t.definingDocId);
      const defined = t.status === 'defined_in_package';
      const label = def ? TYPE_LABELS[def.type] : null;
      const f = findingForTerm(findings, t.term);
      let action: SourceAction = null;
      if (f) action = { kind: 'finding', findingId: f.id };
      else if (defined && def && !def.isPrimary)
        action = {
          kind: 'open',
          docId: def.id,
          blockIndex: t.definitionLocation ? t.definitionLocation.blockIndex : null,
          label: label ?? typeLabel(def.type),
        };
      out.push({
        key: `p:${t.term}`,
        targetKey: t.term.toLowerCase(),
        item: maskAndClamp(t.term, 120),
        kind: defined && label ? `Term · ${label}` : 'Term',
        status: defined
          ? { cls: 'b-ok', icon: 'check', label: 'Defined' }
          : { cls: 'b-fix', icon: 'info', label: 'Unverified' },
        missing: false,
        blockId: null,
        quote: null,
        action,
      });
    }
  }
  return out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map((x) => x.r);
}

/** Sources count: terms that are not defined plus documents missing from the package. */
export function sourcesMissing(rows: SourceRow[]): number {
  return rows.filter((r) => r.missing).length;
}
