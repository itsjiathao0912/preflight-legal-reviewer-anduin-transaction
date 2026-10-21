import {
  maskAndClamp,
  PACKAGE_DOC_TYPES,
  type PackageDocRole,
  type PackageDocType,
} from '@aduin/core';
import { useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { usePackage } from '../../state/package';
import { ROLE_OPTION_LABELS, TYPE_LABELS } from '../open-document/PackageConfirmTable';
import type { PackageActionRefusal, PackageDocView, PackageView } from './contract';

const REFUSAL: Record<PackageActionRefusal, string> = {
  unknown_doc: 'This document is no longer in the package.',
  primary_locked: 'The document to digitize cannot be changed here.',
  cross_firm: 'Only a document from the same firm can be a baseline.',
  role_not_allowed: 'Only a subscription agreement can be a baseline.',
};

/** Same plain words as the Upload confirm step. */
function statusLabel(d: PackageDocView): string {
  if (d.confidence === 'high') return 'Sure';
  return d.confirmed ? 'Checked by you' : 'Please check';
}

const EDIT_ROLES: readonly PackageDocRole[] = ['reference', 'baseline'];

function Row({ d, onError }: { d: PackageDocView; onError: (msg: string | null) => void }) {
  const name = maskAndClamp(d.name, 120);
  const run = (r: { ok: true } | { ok: false; reason: PackageActionRefusal }) =>
    onError(r.ok ? null : `${name}: ${REFUSAL[r.reason]}`);
  return (
    <tr data-testid="package-lens-doc" data-doc-id={d.id}>
      <td className="pkg-lens-name">{name}</td>
      {d.isPrimary ? (
        <>
          <td>{TYPE_LABELS[d.type]}</td>
          <td>{ROLE_OPTION_LABELS.to_digitize}</td>
        </>
      ) : (
        <>
          <td>
            <select
              data-testid="package-lens-doc-type"
              aria-label={`Document type for ${name}`}
              value={d.type}
              onChange={(e) =>
                run(usePackage.getState().setType(d.id, e.target.value as PackageDocType))
              }
            >
              {PACKAGE_DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </td>
          <td>
            <select
              data-testid="package-lens-doc-role"
              aria-label={`Role for ${name}`}
              value={d.role}
              onChange={(e) =>
                run(usePackage.getState().setRole(d.id, e.target.value as PackageDocRole))
              }
            >
              {EDIT_ROLES.map((r) => (
                <option key={r} value={r} disabled={r === 'baseline' && d.type !== 'sub_agreement'}>
                  {ROLE_OPTION_LABELS[r]}
                </option>
              ))}
            </select>
          </td>
        </>
      )}
      <td>
        <span className="pkg-lens-st">
          <Icon name={d.confidence === 'high' || d.confirmed ? 'check' : 'warn'} />
          {statusLabel(d)}
        </span>
      </td>
      <td className="pkg-lens-reason">{maskAndClamp(d.reason, 200)}</td>
    </tr>
  );
}

export function PackageDocuments({ view }: { view: PackageView }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="pkg-lens-sec" data-testid="package-lens-documents" aria-label="Documents">
      <h3>Documents</h3>
      {error ? (
        <p className="pkg-lens-error" role="alert" data-testid="package-lens-action-error">
          <Icon name="stop" />
          {error}
        </p>
      ) : null}
      <table className="pkg-lens-table">
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Type</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Detail description</th>
          </tr>
        </thead>
        <tbody>
          {view.documents.map((d) => (
            <Row key={d.id} d={d} onError={setError} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
