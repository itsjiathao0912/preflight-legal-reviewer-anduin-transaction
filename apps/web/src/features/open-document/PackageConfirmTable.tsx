import {
  maskAndClamp,
  PACKAGE_DOC_ROLES,
  PACKAGE_DOC_TYPES,
  type PackageDocRole,
  type PackageDocType,
  type PackageDocument,
} from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { NO_SUB_LINE, usePackage } from '../../state/package';
import '../../styles/package-intake.css';

export const TYPE_LABELS: Record<PackageDocType, string> = {
  sub_agreement: 'Subscription agreement',
  lpa: 'LPA',
  ppm: 'PPM',
  tax_form: 'Tax form',
  side_letter: 'Side letter',
  other: 'Other',
};
export const ROLE_LABELS: Record<PackageDocRole, string> = {
  to_digitize: 'To digitize',
  reference: 'Reference',
  baseline: 'Baseline (earlier version)',
};

const NAME_MAX = 120;
const REASON_MAX = 200;

/** Masked + clamped display of a file name or detection reason (validate E4). */
export const shown = (s: string, max: number) => maskAndClamp(s, max);

function Row({ d }: { d: PackageDocument }) {
  const setField = usePackage((s) => s.setDraftField);
  const confirm = usePackage((s) => s.confirmDraftRow);
  const remove = usePackage((s) => s.removeDraftRow);
  const name = shown(d.name, NAME_MAX);
  const low = d.confidence === 'low' && !d.confirmed;
  return (
    <tr
      data-testid="package-row"
      data-doc-id={d.id}
      data-confidence={d.confidence}
      data-needs-ocr={d.needsOcr ? 'true' : 'false'}
      data-suggestion-source={d.suggestionSource}
    >
      <td className="pkg-name">
        {name}
        {d.needsOcr ? <div className="mut">needs OCR</div> : null}
      </td>
      <td>
        <select
          data-testid="package-row-type"
          aria-label={`Document type for ${name}`}
          value={d.type}
          onChange={(e) => setField(d.id, 'type', e.target.value)}
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
          data-testid="package-row-role"
          aria-label={`Role for ${name}`}
          value={d.role}
          onChange={(e) => setField(d.id, 'role', e.target.value)}
        >
          {PACKAGE_DOC_ROLES.map((r) => (
            <option key={r} value={r} disabled={r === 'to_digitize' && d.type !== 'sub_agreement'}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td data-testid="package-row-confidence">
        <span className="pkg-conf">
          <Icon name={d.confidence === 'high' ? 'check' : 'warn'} />
          {d.confidence === 'high' ? 'High' : 'Low'}
        </span>
        {low ? (
          <div className="pkg-low-mark" data-testid="package-row-low-mark">
            <Icon name="warn" />
            Needs your confirmation
          </div>
        ) : null}
      </td>
      <td className="pkg-reason" data-testid="package-row-reason">
        {shown(d.reason, REASON_MAX)}
      </td>
      <td>
        <label className="od-ack">
          <input
            type="checkbox"
            data-testid="package-row-confirm"
            aria-label={`Confirm ${name}`}
            checked={d.confirmed}
            disabled={d.confirmed}
            onChange={() => confirm(d.id)}
          />
          Confirmed
        </label>
        <button
          type="button"
          className="btn"
          data-testid="package-row-remove"
          aria-label={`Remove ${name}`}
          onClick={() => remove(d.id)}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

/** Step 2 of the Upload modal: one row per file; Run checks stays disabled until ready. */
export function PackageConfirmTable({ onRun, onBack }: { onRun: () => void; onBack: () => void }) {
  const draft = usePackage((s) => s.draft);
  const readiness = usePackage((s) => s.draftReadiness);
  const setTag = usePackage((s) => s.setDraftTag);
  const addEarlier = usePackage((s) => s.addEarlierDocument);
  if (!draft) return null;
  const ready = readiness();
  return (
    <section className="pkg-step" data-testid="package-confirm-table" aria-labelledby="pkg-h">
      <h3 className="od-h" id="pkg-h">
        Confirm the package{' '}
        <span className="dim">
          {draft.tag.firmName || 'No firm'} · {shown(draft.tag.fund, 120)}
        </span>
      </h3>
      {draft.status === 'reading' ? (
        <p className="mut" role="status">
          Reading the files…
        </p>
      ) : null}
      <label className="nl">
        Version label <span>(required for a package)</span>
        <input
          type="text"
          data-testid="package-version-input"
          value={draft.tag.version}
          onChange={(e) => setTag({ version: e.target.value })}
        />
      </label>
      <table className="pkg-table">
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Type</th>
            <th scope="col">Role</th>
            <th scope="col">Confidence</th>
            <th scope="col">Why</th>
            <th scope="col">Confirm</th>
          </tr>
        </thead>
        <tbody>
          {draft.rows.map((d) => (
            <Row key={d.id} d={d} />
          ))}
        </tbody>
      </table>
      <div data-testid="package-notice" className="pkg-notice" role="status">
        {draft.notice ? <p>{draft.notice}</p> : null}
        {draft.status === 'ready' && ready.noSubAgreement ? (
          <p className="pkg-held">{NO_SUB_LINE}</p>
        ) : null}
        {draft.status === 'ready' && ready.versionMissing ? (
          <p className="pkg-held">Enter the version label before running checks.</p>
        ) : null}
      </div>
      <div>
        <p className="od-h">Earlier documents of this firm (this browser, newest 5)</p>
        <ul className="pkg-earlier" data-testid="package-earlier-list">
          {draft.earlier.map((c) => (
            <li key={c.docId}>
              <button
                type="button"
                className="od-sample"
                data-testid="package-earlier-add"
                data-doc-id={c.docId}
                onClick={() => void addEarlier(c.storedDocId ?? c.docId)}
              >
                <span className="od-t">{shown(c.name, NAME_MAX)}</span>
                <span className="dim">Add as baseline</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="acts od-acts">
        <button type="button" className="btn" data-testid="package-back" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn pri"
          data-testid="package-run"
          disabled={!ready.ok}
          onClick={onRun}
        >
          <Icon name="check" />
          Run checks
        </button>
      </div>
    </section>
  );
}
