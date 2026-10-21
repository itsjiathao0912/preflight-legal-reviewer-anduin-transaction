import { useEffect } from 'react';
import { Icon } from '../../../components/ui/icon';
import { usePackage } from '../../../state/package';
import { useShell } from '../../../state/shell';
import { useRequests } from '../../requests/request-store';
import type { PackageView } from '../../package/contract';
import { openPackageFile } from '../../package/open-file';
import type { SourceAction, SourceRow } from './sources-model';
import { openFinding, showInDoc } from './show';
import '../../../styles/structure.css';

const NONE = 'none';

function Action({ a, row, pkg }: { a: SourceAction; row: SourceRow; pkg: PackageView | null }) {
  if (!a) return null;
  if (a.kind === 'finding')
    return (
      <button
        type="button"
        className="btn lnk"
        data-testid="sources-open-finding"
        aria-label={`Open the finding for ${row.item}`}
        onClick={() => openFinding(a.findingId)}
      >
        Open finding
      </button>
    );
  if (a.kind === 'gp')
    return (
      <button
        type="button"
        className="btn lnk"
        data-testid="sources-gp-request"
        aria-label={`${row.item} is in the GP request`}
        onClick={() => useRequests.getState().openDrawer('gp')}
      >
        GP request
      </button>
    );
  if (a.kind === 'open')
    return pkg ? (
      <button
        type="button"
        className="btn lnk"
        data-testid="sources-open-file"
        aria-label={`Open ${row.item} in ${a.label}`}
        onClick={() => openPackageFile(pkg, a.docId, a.blockIndex)}
      >
        {`Open in ${a.label}`}
      </button>
    ) : null;
  return (
    <select
      data-testid="sources-confirm"
      aria-label={`Confirm the document for ${row.item}`}
      value=""
      onChange={(e) => {
        if (e.target.value) usePackage.getState().confirmTarget(a.targetKey, e.target.value);
      }}
    >
      <option value="">Choose a document…</option>
      {a.candidates.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
      <option value={NONE}>None of these</option>
    </select>
  );
}

/**
 * Sources view (Document map Terms & references, condensed): one table of defined terms with an
 * issue, other documents the agreement cites and terms it leaves to them.
 */
export function SourcesView({ rows, pkg }: { rows: SourceRow[]; pkg: PackageView | null }) {
  // "See in Sources" from a finding: flash the matching row once, then clear the request
  const focus = useShell((s) => s.structureFocus);
  useEffect(() => {
    if (!focus) return;
    useShell.getState().clearStructureFocus();
    const key = focus.key?.toLowerCase();
    if (!key) return;
    let tries = 0;
    const find = () => {
      const el = [...document.querySelectorAll<HTMLElement>('[data-testid="sources-row"]')].find(
        (r) => r.dataset.targetKey === key,
      );
      if (!el) {
        if (tries++ < 10) requestAnimationFrame(find);
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('st-flash');
      void el.offsetWidth;
      el.classList.add('st-flash');
      window.setTimeout(() => el.classList.remove('st-flash'), 1800);
    };
    requestAnimationFrame(find);
  }, [focus]);

  return (
    <>
      <div className="fv2-alt-head">
        <p className="mut">Terms and other documents the agreement relies on.</p>
      </div>
      {rows.length === 0 ? (
        <p className="mut" data-testid="sources-empty">
          No terms or references to check.
        </p>
      ) : (
        <div className="twrap">
          <table className="t fv2-src-t">
            <caption className="sr">Terms and references</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} data-testid="sources-row" data-target-key={r.targetKey}>
                  <td>
                    {r.blockId ? (
                      <button
                        type="button"
                        className="rb"
                        title="Show in document"
                        onClick={() => showInDoc(r.blockId!, r.quote)}
                      >
                        {r.item}
                      </button>
                    ) : (
                      r.item
                    )}
                  </td>
                  <td className="dim">{r.kind}</td>
                  <td>
                    <span className={`badge ${r.status.cls}`}>
                      <Icon name={r.status.icon} />
                      {r.status.label}
                    </span>
                  </td>
                  <td>
                    <Action a={r.action} row={r} pkg={pkg} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
