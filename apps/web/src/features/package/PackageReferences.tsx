import { useState } from 'react';
import { maskAndClamp, type ExternalReference, type TargetFamily } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { usePackage } from '../../state/package';
import { useReview } from '../../state/review';
import type { PackageDocView, PackageView } from './contract';
import { openPackageFile, typeLabel } from './open-file';
import { quoteText } from './quote-text';
import { findingAt, SeeInFindings } from '../structure/SeeInFindings';

const NONE = 'none';

export const FAMILY_LABEL: Record<TargetFamily, string> = {
  lpa: 'LPA',
  ppm: 'PPM',
  side_letter: 'Side letter',
  tax_form: 'Tax form',
  annex: 'Annex',
};

type Res = ExternalReference['resolution'];

/** Group status shown as a badge (existing badge classes). */
export const STATUS: Record<Res, { cls: string; icon: 'check' | 'stop' | 'warn'; label: string }> =
  {
    resolved: { cls: 'b-ok', icon: 'check', label: 'Found' },
    not_in_package: { cls: 'b-block', icon: 'stop', label: 'Missing' },
    unclear: { cls: 'b-fix', icon: 'warn', label: 'Pick a file' },
  };

/** Problems first: Pick a file, then Missing, then Found. */
const RANK: Record<Res, number> = { unclear: 0, not_in_package: 1, resolved: 2 };

type Filter = 'all' | Res;

export function locationText(r: ExternalReference): string {
  const section = r.location.sectionPath.at(-1) ?? 'Start of document';
  return `${section}, paragraph ${r.location.blockIndex + 1}`;
}

/** E10: documents of the reference's family; for annexes, every non-primary document. */
export function candidatesFor(r: ExternalReference, docs: PackageDocView[]): PackageDocView[] {
  return docs.filter(
    (d) => !d.isPrimary && (r.targetFamily === 'annex' || d.type === r.targetFamily),
  );
}

/** The status sentence of one mention ("Resolved to LPA · Section 1.1 (…)", "Not in package"). */
function statusWord(r: ExternalReference, view: PackageView): string {
  const target = view.documents.find((d) => d.id === r.resolvedDocId);
  const part = r.resolution === 'resolved' && target ? r.resolvedPart : undefined;
  if (r.resolution === 'resolved')
    return part
      ? `Resolved to ${typeLabel(target!.type)} · Section ${maskAndClamp(part.label, 12)}${
          part.title ? ` (${maskAndClamp(part.title, 80)})` : ''
        }`
      : `Resolved to ${target ? maskAndClamp(target.name, 120) : 'a document'}`;
  return r.resolution === 'not_in_package' ? 'Not in package' : 'Needs confirmation';
}

/** The worst resolution in a group decides the group's status. */
export function groupResolution(refs: ExternalReference[]): Res {
  return refs.reduce<Res>((w, r) => (RANK[r.resolution] < RANK[w] ? r.resolution : w), 'resolved');
}

function OpenButton({ r, view }: { r: ExternalReference; view: PackageView }) {
  const target = view.documents.find((d) => d.id === r.resolvedDocId);
  if (r.resolution !== 'resolved' || !target || target.isPrimary) return null;
  const part = r.resolvedPart;
  const label = typeLabel(target.type);
  return (
    <button
      type="button"
      className="btn"
      data-testid="package-reference-open"
      aria-label={
        part
          ? `Open Section ${maskAndClamp(part.label, 12)} in ${label}`
          : `Open ${maskAndClamp(target.name, 120)} in ${label}`
      }
      onClick={() => openPackageFile(view, target.id, part ? part.blockIndex : null)}
    >
      {`Open in ${label} →`}
    </button>
  );
}

function ShowButton({
  r,
  onShow,
}: {
  r: ExternalReference;
  onShow: (blockId: string, quote?: string | null) => void;
}) {
  const blockId = useReview((s) => s.result?.blocks[r.location.blockIndex]?.id ?? null);
  if (!blockId) return null;
  return (
    <button
      type="button"
      className="btn"
      data-testid="package-reference-show"
      aria-label={`Show ${maskAndClamp(r.targetLabel, 80)} reference in the document, ${locationText(r)}`}
      onClick={() => onShow(blockId, r.quote)}
    >
      <Icon name="eye" />
      Show in document
    </button>
  );
}

function Group({
  refs,
  view,
  onShow,
  open,
  onToggle,
}: {
  refs: ExternalReference[];
  view: PackageView;
  onShow: (blockId: string, quote?: string | null) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const first = refs[0]!;
  const res = groupResolution(refs);
  const st = STATUS[res];
  const label = maskAndClamp(first.targetLabel, 80);
  const resolved = refs.find((r) => r.resolution === 'resolved');
  const target = resolved ? view.documents.find((d) => d.id === resolved.resolvedDocId) : undefined;
  const unclear = refs.find((r) => r.resolution === 'unclear');
  const cands = unclear ? candidatesFor(unclear, view.documents) : [];
  const findings = useReview((s) => s.result?.findings);
  const linked = refs
    .map((r) => findingAt(findings, r.location.blockIndex, first.targetLabel))
    .find(Boolean);
  const listId = `pkg-ref-${first.targetKey.replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <>
      <tr
        className="pkg-ref-g"
        data-testid="package-reference-group"
        data-target-key={first.targetKey}
        data-resolution={res}
      >
        <td>
          <span className="badge b-st">{FAMILY_LABEL[first.targetFamily]}</span>
        </td>
        <td>
          <button
            type="button"
            className="rb pkg-ref-name"
            aria-expanded={open}
            aria-controls={listId}
            onClick={onToggle}
          >
            <Icon name={open ? 'chevd' : 'chev'} />
            {label}
          </button>
        </td>
        <td className="pkg-ref-n">{refs.length}</td>
        <td>
          <span className={`badge ${st.cls}`}>
            <Icon name={st.icon} />
            {st.label}
          </span>
        </td>
        <td className="pkg-ref-file">
          {unclear ? (
            <select
              data-testid="package-reference-confirm"
              aria-label={`Confirm the document for ${label}`}
              value=""
              onChange={(e) => {
                if (e.target.value)
                  usePackage.getState().confirmTarget(first.targetKey, e.target.value);
              }}
            >
              <option value="">Choose a document…</option>
              {cands.map((d) => (
                <option key={d.id} value={d.id}>
                  {maskAndClamp(d.name, 120)}
                </option>
              ))}
              <option value={NONE}>None of these</option>
            </select>
          ) : target ? (
            <span title={target.name}>{maskAndClamp(target.name, 120)}</span>
          ) : (
            <span className="dim">Not uploaded · in the GP request</span>
          )}
        </td>
        <td className="pkg-ref-acts">
          <ShowButton r={first} onShow={onShow} />
          {resolved ? <OpenButton r={resolved} view={view} /> : null}
          {linked ? <SeeInFindings findingId={linked.id} label={label} /> : null}
        </td>
      </tr>
      {refs.map((r) => (
        <tr
          key={r.id}
          id={r === first ? listId : undefined}
          className="pkg-ref-m"
          hidden={!open}
          data-testid="package-reference"
          data-resolution={r.resolution}
          data-target-key={r.targetKey}
        >
          <td />
          <td colSpan={3}>
            <q className="pkg-lens-quote">{quoteText(r.quote)}</q>
            <span className="sr"> {statusWord(r, view)}</span>
          </td>
          <td className="dim">{locationText(r)}</td>
          <td className="pkg-ref-acts">
            <ShowButton r={r} onShow={onShow} />
          </td>
        </tr>
      ))}
    </>
  );
}

export function PackageReferences({
  view,
  onShow,
}: {
  view: PackageView;
  onShow: (blockId: string, quote?: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = new Map<string, ExternalReference[]>();
  for (const r of view.references) {
    const g = groups.get(r.targetKey);
    if (g) g.push(r);
    else groups.set(r.targetKey, [r]);
  }
  const all = [...groups.values()].sort(
    (a, b) => RANK[groupResolution(a)] - RANK[groupResolution(b)],
  );
  const count = (f: Res) => all.filter((g) => groupResolution(g) === f).length;
  const shown = filter === 'all' ? all : all.filter((g) => groupResolution(g) === filter);
  const segs: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: all.length },
    { id: 'not_in_package', label: 'Missing', n: count('not_in_package') },
    { id: 'unclear', label: 'Pick a file', n: count('unclear') },
    { id: 'resolved', label: 'Found', n: count('resolved') },
  ];
  return (
    <section
      className="pkg-lens-sec"
      data-testid="package-lens-references"
      aria-label="References to other documents"
    >
      <div className="sechead pkg-sechead">
        <h3>References to other documents</h3>
        <span className="dim">
          {all.length} {all.length === 1 ? 'document' : 'documents'} cited ·{' '}
          {view.references.length} {view.references.length === 1 ? 'mention' : 'mentions'}
        </span>
        {all.length ? (
          <div className="seg pkg-seg" role="group" aria-label="Filter references by status">
            {segs.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={filter === s.id}
                onClick={() => setFilter(s.id)}
              >
                {s.label} <span className="dim">{s.n}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {all.length === 0 ? <p className="mut">No references to other documents.</p> : null}
      {shown.length ? (
        <div className="twrap">
          <table className="t pkg-ref-t">
            <caption className="sr">References to other documents</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Document cited</th>
                <th scope="col">Mentions</th>
                <th scope="col">Status</th>
                <th scope="col">Matched file</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((refs) => {
                const key = refs[0]!.targetKey;
                return (
                  <Group
                    key={key}
                    refs={refs}
                    view={view}
                    onShow={onShow}
                    open={!!open[key]}
                    onToggle={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : all.length ? (
        <p className="mut">Nothing with this status.</p>
      ) : null}
      {count('not_in_package') ? (
        <p className="mut pkg-ref-foot">
          Missing documents are listed in the “For the GP” request.
        </p>
      ) : null}
    </section>
  );
}
