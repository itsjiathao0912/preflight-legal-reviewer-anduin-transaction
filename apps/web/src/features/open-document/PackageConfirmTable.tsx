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
/** Role names for the Upload confirm step and the Documents screen file list. */
export const ROLE_OPTION_LABELS: Record<PackageDocRole, string> = ROLE_LABELS;

const NAME_MAX = 120;
const REASON_MAX = 200;

/** Masked + clamped display of a file name or detection reason (validate E4). */
export const shown = (s: string, max: number) => maskAndClamp(s, max);

type ProblemLine = { key: string; code: string; text: string };

/** Short name for a file: its leading number ("01-NG3-..." -> "01"), else the shown name. */
function shortName(name: string): string {
  const m = /^\d+/.exec(name);
  return m ? m[0] : shown(name, NAME_MAX);
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Plain lines for the readiness problems (per-row ones merged), so a disabled Run checks says why. */
function problemLines(
  problems: readonly { code: string; docId?: string }[],
  rows: readonly PackageDocument[],
  noSub: boolean,
): ProblemLine[] {
  const out: ProblemLine[] = [];
  const rowNames: string[] = [];
  let rowCode: string | null = null;
  for (const p of problems) {
    if (p.code === 'multiple_to_digitize') {
      const n = rows.filter((r) => r.role === 'to_digitize').length;
      out.push({
        key: p.code,
        code: p.code,
        text: `Only one file can be To digitize (${n} are picked now). Set the others to Reference or Baseline, or remove them.`,
      });
    } else if (p.code === 'no_to_digitize') {
      if (!noSub)
        out.push({
          key: p.code,
          code: p.code,
          text: 'No file is set to To digitize. Set the subscription agreement to To digitize.',
        });
    } else {
      const row = rows.find((r) => r.id === p.docId);
      if (row) {
        rowNames.push(shortName(row.name));
        rowCode ??= p.code;
      }
    }
  }
  if (rowCode)
    out.push({ key: 'rows', code: rowCode, text: `Tick Looks right on ${joinNames(rowNames)}.` });
  return out;
}

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
      data-confirmed={d.confirmed ? 'true' : 'false'}
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
              {ROLE_OPTION_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td data-testid="package-row-confidence">
        {d.confidence === 'high' ? (
          <span className="pkg-conf">
            <Icon name="check" />
            Sure
          </span>
        ) : low ? (
          <div className="pkg-low-cell">
            <div className="pkg-low-mark" data-testid="package-row-low-mark">
              <Icon name="warn" />
              Please check
            </div>
            <button
              type="button"
              className="btn pkg-ok"
              data-testid="package-row-confirm"
              aria-label={`Looks right: confirm ${name}`}
              onClick={() => confirm(d.id)}
            >
              Looks right
            </button>
          </div>
        ) : (
          <span className="pkg-conf" data-testid="package-row-checked">
            <Icon name="check" />
            Checked
          </span>
        )}
      </td>
      <td className="pkg-reason" data-testid="package-row-reason">
        {shown(d.reason, REASON_MAX)}
      </td>
      <td className="pkg-rm-cell">
        <button
          type="button"
          className="pkg-rm"
          data-testid="package-row-remove"
          aria-label={`Remove ${name}`}
          title={`Remove ${name}`}
          onClick={() => remove(d.id)}
        >
          <Icon name="x" />
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
  const lines =
    draft.status === 'ready' ? problemLines(ready.problems, draft.rows, ready.noSubAgreement) : [];
  return (
    <section className="pkg-step" data-testid="package-confirm-table" aria-labelledby="pkg-h">
      <h3 className="od-h" id="pkg-h">
        Check your files{' '}
        <span className="dim">
          {draft.tag.firmName || 'No firm'} · {shown(draft.tag.fund, 120)}
        </span>
      </h3>
      <p className="mut">
        Pick the one file To digitize. Then press Looks right on any file marked Please check.
      </p>
      {draft.status === 'reading' ? (
        <p className="mut" role="status">
          Reading the files…
        </p>
      ) : null}
      <label className="nl">
        Version name <span>To tell this upload apart from later ones, e.g. v1 or 2026.</span>
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
            <th scope="col">Sure?</th>
            <th scope="col">Detail description</th>
            <th scope="col" className="pkg-rm-cell">
              <span className="sr">Remove</span>
            </th>
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
          <p className="pkg-held">Enter a version name before you run checks.</p>
        ) : null}
        {lines.length > 0 ? <p className="pkg-held">Before you run checks:</p> : null}
        {lines.map((l) => (
          <p key={l.key} className="pkg-held" data-testid="package-problem" data-code={l.code}>
            {l.text}
          </p>
        ))}
      </div>
      {draft.earlier.length > 0 ? (
        <div>
          <p className="od-h">Older versions from {draft.tag.firmName || 'this firm'}</p>
          <p className="mut">Uploaded before in this browser. Click one to compare with it.</p>
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
                  <span className="dim">Compare with this</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
